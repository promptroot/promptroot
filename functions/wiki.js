const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const {
  resolveBearer,
  requireMembership,
  tenantIsReadable,
  authError
} = require('./wiki-auth');
const { chunkDoc } = require('./lib/chunker.cjs');
const { validateFrontmatter, validateTenant } = require('./lib/sdd-validate.cjs');

const ALLOWED_ORIGINS = [
  'https://promptroot.io',
  'https://promptroot.ai',
  'http://localhost:3000',
  'http://localhost:5000'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Vary', 'Origin');
}

function generateVersionId() {
  const ts = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}_${rand}`;
}

function extractHeadings(body) {
  const headings = [];
  for (const line of String(body || '').split(/\r?\n/)) {
    const m = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }
  return headings;
}

function buildSddDoc({ tenantId, slug, frontmatter, body, currentVersion, lastEditorUid }) {
  return {
    tenantId,
    slug,
    title: frontmatter.title,
    status: frontmatter.status,
    owner: frontmatter.owner,
    date: frontmatter.date,
    tags: frontmatter.tags || [],
    related: frontmatter.related || [],
    visibility: frontmatter.visibility,
    body,
    headings: extractHeadings(body),
    currentVersion,
    lastEditorUid,
    lastModified: admin.firestore.FieldValue.serverTimestamp()
  };
}

function buildVersionDoc({ frontmatter, body, authorUid, authorName, changeNote }) {
  return {
    body,
    frontmatter,
    authorUid,
    authorName: authorName || null,
    savedAt: admin.firestore.FieldValue.serverTimestamp(),
    changeNote: changeNote || null
  };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

function sendError(res, statusCode, message, details) {
  res.status(statusCode).json({ error: message, ...(details ? { details } : {}) });
}

async function withAuth(req, res, handler) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  let auth;
  try {
    auth = await resolveBearer(req.headers.authorization);
  } catch (err) {
    sendError(res, err.statusCode || 401, err.message);
    return;
  }
  try {
    await handler(auth);
  } catch (err) {
    if (err.statusCode) {
      sendError(res, err.statusCode, err.message, err.details);
      return;
    }
    logger.error('wiki endpoint error:', err.message, err.stack);
    sendError(res, 500, 'Internal error');
  }
}

const createSdd = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId, slug, frontmatter, body: docBody, changeNote } = body;
    if (!tenantId || !slug) throw authError('tenantId and slug are required', 400);
    if (!frontmatter || typeof frontmatter !== 'object') throw authError('frontmatter is required', 400);
    if (typeof docBody !== 'string') throw authError('body must be a string', 400);

    const fm = { ...frontmatter, slug };
    const fmErrors = validateFrontmatter(fm);
    if (fmErrors.length) throw authError(`frontmatter validation failed: ${fmErrors.join('; ')}`, 400);

    await requireMembership(uid, tenantId);

    const db = admin.firestore();
    const sddRef = db.doc(`tenants/${tenantId}/sdds/${slug}`);
    const existing = await sddRef.get();
    if (existing.exists) throw authError(`SDD ${slug} already exists in tenant ${tenantId}`, 409);

    const versionId = generateVersionId();
    const versionRef = sddRef.collection('versions').doc(versionId);

    const userRecord = await admin.auth().getUser(uid).catch(() => null);
    const authorName = userRecord?.displayName || userRecord?.email || null;

    const batch = db.batch();
    batch.set(sddRef, buildSddDoc({
      tenantId,
      slug,
      frontmatter: fm,
      body: docBody,
      currentVersion: versionId,
      lastEditorUid: uid
    }));
    batch.set(versionRef, buildVersionDoc({
      frontmatter: fm,
      body: docBody,
      authorUid: uid,
      authorName,
      changeNote
    }));
    await batch.commit();

    res.json({
      tenantId,
      slug,
      versionId,
      url: `/wiki/${tenantId}/${slug}`
    });
  });
});

const updateSdd = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId, slug, frontmatter, body: docBody, changeNote } = body;
    if (!tenantId || !slug) throw authError('tenantId and slug are required', 400);

    await requireMembership(uid, tenantId);

    const db = admin.firestore();
    const sddRef = db.doc(`tenants/${tenantId}/sdds/${slug}`);
    const existing = await sddRef.get();
    if (!existing.exists) throw authError(`SDD ${slug} not found in tenant ${tenantId}`, 404);

    const prev = existing.data();
    const mergedFrontmatter = {
      title: prev.title,
      slug: prev.slug,
      date: prev.date,
      status: prev.status,
      owner: prev.owner,
      tags: prev.tags || [],
      related: prev.related || [],
      visibility: prev.visibility,
      ...(frontmatter || {}),
      slug: prev.slug
    };
    const fmErrors = validateFrontmatter(mergedFrontmatter);
    if (fmErrors.length) throw authError(`frontmatter validation failed: ${fmErrors.join('; ')}`, 400);

    const newBody = typeof docBody === 'string' ? docBody : prev.body;

    const versionId = generateVersionId();
    const versionRef = sddRef.collection('versions').doc(versionId);

    const userRecord = await admin.auth().getUser(uid).catch(() => null);
    const authorName = userRecord?.displayName || userRecord?.email || null;

    const batch = db.batch();
    batch.set(sddRef, buildSddDoc({
      tenantId,
      slug,
      frontmatter: mergedFrontmatter,
      body: newBody,
      currentVersion: versionId,
      lastEditorUid: uid
    }), { merge: true });
    batch.set(versionRef, buildVersionDoc({
      frontmatter: mergedFrontmatter,
      body: newBody,
      authorUid: uid,
      authorName,
      changeNote
    }));
    await batch.commit();

    res.json({ tenantId, slug, versionId });
  });
});

const listSdds = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId } = body;
    if (!tenantId) throw authError('tenantId is required', 400);

    const access = await tenantIsReadable(uid, tenantId);
    if (!access.ok) throw authError(`Tenant ${tenantId} not accessible`, access.reason === 'not_found' ? 404 : 403);

    const isMember = Array.isArray(access.tenant.members) && access.tenant.members.includes(uid);
    const db = admin.firestore();
    let q = db.collection(`tenants/${tenantId}/sdds`);
    if (!isMember) q = q.where('visibility', '==', 'public');
    const snap = await q.get();

    const sdds = snap.docs.map(d => {
      const data = d.data();
      return {
        slug: data.slug,
        title: data.title,
        status: data.status,
        owner: data.owner,
        date: data.date,
        tags: data.tags || [],
        related: data.related || [],
        visibility: data.visibility,
        currentVersion: data.currentVersion,
        lastModified: data.lastModified?.toDate?.()?.toISOString() || null
      };
    });

    res.json({ tenantId, sdds });
  });
});

const getSdd = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId, slug, version } = body;
    if (!tenantId || !slug) throw authError('tenantId and slug are required', 400);

    const access = await tenantIsReadable(uid, tenantId);
    if (!access.ok) throw authError(`Tenant ${tenantId} not accessible`, access.reason === 'not_found' ? 404 : 403);

    const db = admin.firestore();
    const sddRef = db.doc(`tenants/${tenantId}/sdds/${slug}`);
    const sddSnap = await sddRef.get();
    if (!sddSnap.exists) throw authError(`SDD ${slug} not found`, 404);
    const sdd = sddSnap.data();

    const isMember = Array.isArray(access.tenant.members) && access.tenant.members.includes(uid);
    if (sdd.visibility === 'private' && !isMember) {
      throw authError('SDD is private', 403);
    }

    if (!version) {
      res.json({
        tenantId,
        slug,
        title: sdd.title,
        status: sdd.status,
        owner: sdd.owner,
        date: sdd.date,
        tags: sdd.tags || [],
        related: sdd.related || [],
        visibility: sdd.visibility,
        body: sdd.body,
        headings: sdd.headings || [],
        currentVersion: sdd.currentVersion,
        lastModified: sdd.lastModified?.toDate?.()?.toISOString() || null
      });
      return;
    }

    const verSnap = await sddRef.collection('versions').doc(version).get();
    if (!verSnap.exists) throw authError(`Version ${version} not found`, 404);
    const ver = verSnap.data();
    res.json({
      tenantId,
      slug,
      version,
      body: ver.body,
      frontmatter: ver.frontmatter,
      authorUid: ver.authorUid,
      authorName: ver.authorName,
      changeNote: ver.changeNote,
      savedAt: ver.savedAt?.toDate?.()?.toISOString() || null
    });
  });
});

const listVersions = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId, slug } = body;
    if (!tenantId || !slug) throw authError('tenantId and slug are required', 400);

    const access = await tenantIsReadable(uid, tenantId);
    if (!access.ok) throw authError(`Tenant ${tenantId} not accessible`, access.reason === 'not_found' ? 404 : 403);

    const db = admin.firestore();
    const sddSnap = await db.doc(`tenants/${tenantId}/sdds/${slug}`).get();
    if (!sddSnap.exists) throw authError(`SDD ${slug} not found`, 404);

    const isMember = Array.isArray(access.tenant.members) && access.tenant.members.includes(uid);
    if (sddSnap.data().visibility === 'private' && !isMember) {
      throw authError('SDD is private', 403);
    }

    const snap = await db.collection(`tenants/${tenantId}/sdds/${slug}/versions`)
      .orderBy('savedAt', 'desc')
      .limit(200)
      .get();

    const versions = snap.docs.map(d => {
      const data = d.data();
      return {
        versionId: d.id,
        authorUid: data.authorUid,
        authorName: data.authorName,
        savedAt: data.savedAt?.toDate?.()?.toISOString() || null,
        changeNote: data.changeNote
      };
    });

    res.json({ tenantId, slug, versions });
  });
});

const restoreVersion = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { tenantId, slug, versionId } = body;
    if (!tenantId || !slug || !versionId) {
      throw authError('tenantId, slug, and versionId are required', 400);
    }

    await requireMembership(uid, tenantId);

    const db = admin.firestore();
    const sddRef = db.doc(`tenants/${tenantId}/sdds/${slug}`);
    const verRef = sddRef.collection('versions').doc(versionId);
    const verSnap = await verRef.get();
    if (!verSnap.exists) throw authError(`Version ${versionId} not found`, 404);

    const ver = verSnap.data();
    const newVersionId = generateVersionId();
    const newVerRef = sddRef.collection('versions').doc(newVersionId);

    const userRecord = await admin.auth().getUser(uid).catch(() => null);
    const authorName = userRecord?.displayName || userRecord?.email || null;

    const batch = db.batch();
    batch.set(sddRef, buildSddDoc({
      tenantId,
      slug,
      frontmatter: ver.frontmatter,
      body: ver.body,
      currentVersion: newVersionId,
      lastEditorUid: uid
    }), { merge: true });
    batch.set(newVerRef, buildVersionDoc({
      frontmatter: ver.frontmatter,
      body: ver.body,
      authorUid: uid,
      authorName,
      changeNote: `Restore of ${versionId}`
    }));
    await batch.commit();

    res.json({ tenantId, slug, versionId: newVersionId, restoredFrom: versionId });
  });
});

const createTenant = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const body = await readJsonBody(req);
    const { slug, name, description, visibility, githubRepo } = body;
    const tenantInput = {
      slug,
      name,
      visibility: visibility || 'private',
      ownerUid: uid,
      members: [uid]
    };
    const errors = validateTenant(tenantInput);
    if (errors.length) throw authError(`tenant validation failed: ${errors.join('; ')}`, 400);

    const db = admin.firestore();
    const tenantRef = db.doc(`tenants/${slug}`);
    const existing = await tenantRef.get();
    if (existing.exists) throw authError(`Tenant slug ${slug} already taken`, 409);

    const now = admin.firestore.FieldValue.serverTimestamp();
    await tenantRef.set({
      slug,
      name,
      description: description || '',
      visibility: tenantInput.visibility,
      ownerUid: uid,
      members: [uid],
      githubRepo: githubRepo || null,
      mirrorEnabled: false,
      createdAt: now,
      updatedAt: now
    });

    res.json({ tenantId: slug, slug });
  });
});

const listTenants = onRequest({ cors: false }, async (req, res) => {
  await withAuth(req, res, async ({ uid }) => {
    const db = admin.firestore();
    const snap = await db.collection('tenants')
      .where('members', 'array-contains', uid)
      .get();

    const tenants = snap.docs.map(d => {
      const data = d.data();
      return {
        tenantId: d.id,
        slug: data.slug,
        name: data.name,
        description: data.description || '',
        visibility: data.visibility,
        ownerUid: data.ownerUid,
        memberCount: Array.isArray(data.members) ? data.members.length : 0,
        githubRepo: data.githubRepo || null,
        mirrorEnabled: !!data.mirrorEnabled,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
      };
    });

    res.json({ tenants });
  });
});

module.exports = {
  createSdd,
  updateSdd,
  listSdds,
  getSdd,
  listVersions,
  restoreVersion,
  createTenant,
  listTenants
};
