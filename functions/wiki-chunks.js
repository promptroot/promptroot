const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { chunkDoc } = require('../scripts/lib/chunker.cjs');

const TTL_MS = 5 * 60 * 1000;
const SEED_TENANT_ID = 'promptroot';
const BUNDLED_CHUNKS_URL = 'https://promptroot.ai/wiki/_chunks.json';

const tenantCache = new Map();
let bundledCache = { chunks: null, fetchedAt: 0 };

function isFresh(entry) {
  return entry && entry.chunks && (Date.now() - entry.fetchedAt) < TTL_MS;
}

async function loadBundledChunks() {
  if (isFresh(bundledCache)) return bundledCache.chunks;
  const resp = await fetch(BUNDLED_CHUNKS_URL, { headers: { 'cache-control': 'no-cache' } });
  if (!resp.ok) throw new Error(`Failed to fetch bundled wiki chunks: ${resp.status}`);
  const payload = await resp.json();
  const chunks = Array.isArray(payload.chunks) ? payload.chunks : [];
  bundledCache = { chunks, fetchedAt: Date.now() };
  return chunks;
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

  if (tenantId === SEED_TENANT_ID) {
    const db = admin.firestore();
    const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
    if (!tenantSnap.exists) {
      const chunks = await loadBundledChunks();
      tenantCache.set(tenantId, { chunks, fetchedAt: Date.now() });
      return chunks;
    }
  }

  const chunks = await buildTenantChunks(tenantId);
  tenantCache.set(tenantId, { chunks, fetchedAt: Date.now() });
  return chunks;
}

function invalidateTenantCache(tenantId) {
  if (tenantId) tenantCache.delete(tenantId);
  else tenantCache.clear();
}

async function listAccessibleTenantIds(uid) {
  const db = admin.firestore();
  if (uid) {
    const memberSnap = await db.collection('tenants')
      .where('members', 'array-contains', uid)
      .get();
    return memberSnap.docs.map(d => d.id);
  }
  const publicSnap = await db.collection('tenants')
    .where('visibility', '==', 'public')
    .limit(100)
    .get();
  return publicSnap.docs.map(d => d.id);
}

async function tenantIsAccessible(tenantId, uid) {
  const db = admin.firestore();
  const snap = await db.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) {
    return tenantId === SEED_TENANT_ID;
  }
  const data = snap.data();
  if (data.visibility === 'public') return true;
  if (!uid) return false;
  return Array.isArray(data.members) && data.members.includes(uid);
}

module.exports = {
  TTL_MS,
  SEED_TENANT_ID,
  BUNDLED_CHUNKS_URL,
  loadBundledChunks,
  loadTenantChunks,
  buildTenantChunks,
  invalidateTenantCache,
  listAccessibleTenantIds,
  tenantIsAccessible,
  _setBundledCacheForTest: (chunks) => {
    bundledCache = { chunks, fetchedAt: Date.now() };
  },
  _setTenantCacheForTest: (tenantId, chunks) => {
    tenantCache.set(tenantId, { chunks, fetchedAt: Date.now() });
  },
  _resetCachesForTest: () => {
    bundledCache = { chunks: null, fetchedAt: 0 };
    tenantCache.clear();
  }
};
