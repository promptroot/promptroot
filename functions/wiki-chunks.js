const admin = require('firebase-admin');
const { chunkDoc } = require('./lib/chunker.cjs');

const TTL_MS = 5 * 60 * 1000;
const SEED_TENANT_ID = 'promptroot';

const tenantCache = new Map();

function isFresh(entry) {
  return entry && entry.chunks && (Date.now() - entry.fetchedAt) < TTL_MS;
}

async function buildTenantChunks(tenantId) {
  const db = admin.firestore();
  const sddSnap = await db.collection(`tenants/${tenantId}/sdds`).get();
  const chunks = [];
  for (const doc of sddSnap.docs) {
    const data = doc.data();
    if (!data || typeof data.body !== 'string') continue;
    const docMeta = {
      slug: data.slug,
      title: data.title,
      docPath: `wiki/${tenantId}/${data.slug}.md`,
      visibility: data.visibility,
      tags: data.tags || [],
      date: data.date
    };
    for (const chunk of chunkDoc(docMeta, data.body)) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

async function loadTenantChunks(tenantId) {
  const cached = tenantCache.get(tenantId);
  if (isFresh(cached)) return cached.chunks;

  const chunks = await buildTenantChunks(tenantId);
  tenantCache.set(tenantId, { chunks, fetchedAt: Date.now() });
  return chunks;
}

function invalidateTenantCache(tenantId) {
  if (tenantId) tenantCache.delete(tenantId);
  else tenantCache.clear();
}

async function listAccessibleTenantIds(uid) {
  if (!uid) return [];
  const db = admin.firestore();
  const memberSnap = await db.collection('tenants')
    .where('members', 'array-contains', uid)
    .get();
  return memberSnap.docs.map(d => d.id);
}

async function tenantIsAccessible(tenantId, uid) {
  if (!uid) return false;
  const db = admin.firestore();
  const snap = await db.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) return false;
  const data = snap.data();
  return Array.isArray(data.members) && data.members.includes(uid);
}

module.exports = {
  TTL_MS,
  SEED_TENANT_ID,
  loadTenantChunks,
  buildTenantChunks,
  invalidateTenantCache,
  listAccessibleTenantIds,
  tenantIsAccessible,
  _setTenantCacheForTest: (tenantId, chunks) => {
    tenantCache.set(tenantId, { chunks, fetchedAt: Date.now() });
  },
  _resetCachesForTest: () => {
    tenantCache.clear();
  }
};
