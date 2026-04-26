const admin = require('firebase-admin');
const { webcrypto: crypto } = require('crypto');

const SESSION_TOKEN_PREFIX = 'prs_';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', Buffer.from(str, 'utf8'));
  return Buffer.from(buf).toString('hex');
}

function authError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function resolveSessionToken(token) {
  const tokenHash = await sha256Hex(token);
  const db = admin.firestore();
  const snap = await db.collection('userSessions')
    .where('tokenHash', '==', tokenHash)
    .where('revokedAt', '==', null)
    .limit(1)
    .get();
  if (snap.empty) throw authError('Invalid or revoked session token', 401);
  const doc = snap.docs[0];
  doc.ref.update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() })
    .catch(() => {});
  return { uid: doc.data().uid, sessionId: doc.id };
}

async function resolveFirebaseIdToken(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, sessionId: null };
  } catch {
    throw authError('Invalid or expired Firebase ID token', 401);
  }
}

async function resolveBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw authError('Missing Authorization header', 401);
  }
  const token = authHeader.substring('Bearer '.length).trim();
  if (!token) throw authError('Empty bearer token', 401);

  if (token.startsWith(SESSION_TOKEN_PREFIX)) {
    return resolveSessionToken(token);
  }
  return resolveFirebaseIdToken(token);
}

async function requireMembership(uid, tenantId) {
  if (!tenantId) throw authError('tenantId is required', 400);
  const db = admin.firestore();
  const snap = await db.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) throw authError(`Tenant ${tenantId} not found`, 404);
  const data = snap.data();
  const members = Array.isArray(data.members) ? data.members : [];
  if (!members.includes(uid)) {
    throw authError(`Not a member of tenant ${tenantId}`, 403);
  }
  return { tenant: data, ref: snap.ref };
}

async function tenantIsReadable(uid, tenantId) {
  const db = admin.firestore();
  const snap = await db.doc(`tenants/${tenantId}`).get();
  if (!snap.exists) return { ok: false, reason: 'not_found' };
  const data = snap.data();
  if (data.visibility === 'public') return { ok: true, tenant: data, ref: snap.ref };
  if (uid && Array.isArray(data.members) && data.members.includes(uid)) {
    return { ok: true, tenant: data, ref: snap.ref };
  }
  return { ok: false, reason: 'forbidden' };
}

module.exports = {
  SESSION_TOKEN_PREFIX,
  sha256Hex,
  authError,
  resolveBearer,
  resolveSessionToken,
  resolveFirebaseIdToken,
  requireMembership,
  tenantIsReadable
};
