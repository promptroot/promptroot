const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { webcrypto: crypto } = require('crypto');
const { sha256Hex, resolveFirebaseIdToken, authError, SESSION_TOKEN_PREFIX } = require('./wiki-auth');

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

function sendError(res, statusCode, message) {
  res.status(statusCode).json({ error: message });
}

const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEVICE_CODE_BYTES = 24;
const SESSION_TOKEN_BYTES = 32;
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;

function randomBase64Url(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString('base64url');
}

function randomUserCode() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += USER_CODE_ALPHABET[arr[i] % USER_CODE_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

function deviceFlowVerificationUrl() {
  return process.env.DEVICE_FLOW_VERIFICATION_URL
    || 'https://promptroot.ai/auth/device';
}

const startDeviceAuth = onRequest({ cors: false }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  try {
    const { deviceLabel } = req.body || {};
    const deviceCode = randomBase64Url(DEVICE_CODE_BYTES);
    const userCode = randomUserCode();
    const now = Date.now();
    const db = admin.firestore();

    await db.doc(`deviceAuthRequests/${deviceCode}`).set({
      userCode,
      deviceLabel: typeof deviceLabel === 'string' && deviceLabel.length <= 120 ? deviceLabel : 'Unknown device',
      status: 'pending',
      uid: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(now + DEVICE_CODE_TTL_MS)
    });

    res.json({
      deviceCode,
      userCode,
      verificationUrl: deviceFlowVerificationUrl(),
      expiresInSeconds: Math.floor(DEVICE_CODE_TTL_MS / 1000),
      pollIntervalSeconds: POLL_INTERVAL_SECONDS
    });
  } catch (err) {
    logger.error('startDeviceAuth error:', err.message);
    sendError(res, 500, 'Internal error');
  }
});

const pollDeviceAuth = onRequest({ cors: false }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  try {
    const { deviceCode } = req.body || {};
    if (!deviceCode || typeof deviceCode !== 'string') {
      sendError(res, 400, 'deviceCode is required');
      return;
    }
    const db = admin.firestore();
    const ref = db.doc(`deviceAuthRequests/${deviceCode}`);
    const snap = await ref.get();
    if (!snap.exists) { sendError(res, 404, 'Unknown deviceCode'); return; }
    const data = snap.data();
    const now = Date.now();
    const expiresMs = data.expiresAt?.toMillis?.() || 0;
    if (expiresMs && expiresMs < now) {
      res.json({ status: 'expired' });
      return;
    }
    if (data.status === 'pending') {
      res.json({ status: 'pending', pollIntervalSeconds: POLL_INTERVAL_SECONDS });
      return;
    }
    if (data.status === 'consumed') {
      sendError(res, 410, 'Device code already consumed');
      return;
    }
    if (data.status !== 'authorized' || !data.uid) {
      res.json({ status: 'pending', pollIntervalSeconds: POLL_INTERVAL_SECONDS });
      return;
    }

    const sessionToken = `${SESSION_TOKEN_PREFIX}${randomBase64Url(SESSION_TOKEN_BYTES)}`;
    const tokenHash = await sha256Hex(sessionToken);
    const sessionRef = db.collection('userSessions').doc();
    const batch = db.batch();
    batch.set(sessionRef, {
      uid: data.uid,
      tokenHash,
      deviceLabel: data.deviceLabel || 'Unknown device',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedAt: null
    });
    batch.update(ref, {
      status: 'consumed',
      consumedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();

    res.json({
      status: 'authorized',
      sessionToken,
      sessionId: sessionRef.id,
      uid: data.uid
    });
  } catch (err) {
    logger.error('pollDeviceAuth error:', err.message);
    sendError(res, 500, 'Internal error');
  }
});

const authorizeDevice = onRequest({ cors: false }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  try {
    const auth = await resolveFirebaseIdToken(extractBearer(req)).catch(err => {
      throw err;
    });
    const { userCode } = req.body || {};
    if (!userCode || typeof userCode !== 'string') {
      sendError(res, 400, 'userCode is required');
      return;
    }
    const normalized = userCode.trim().toUpperCase();
    const db = admin.firestore();
    const snap = await db.collection('deviceAuthRequests')
      .where('userCode', '==', normalized)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (snap.empty) {
      sendError(res, 404, 'Invalid or already-used code');
      return;
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const expiresMs = data.expiresAt?.toMillis?.() || 0;
    if (expiresMs && expiresMs < Date.now()) {
      sendError(res, 410, 'Code expired');
      return;
    }
    await doc.ref.update({
      status: 'authorized',
      uid: auth.uid,
      authorizedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ ok: true, deviceLabel: data.deviceLabel || null });
  } catch (err) {
    if (err.statusCode) { sendError(res, err.statusCode, err.message); return; }
    logger.error('authorizeDevice error:', err.message);
    sendError(res, 500, 'Internal error');
  }
});

const listSessions = onRequest({ cors: false }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  try {
    const auth = await resolveFirebaseIdToken(extractBearer(req));
    const db = admin.firestore();
    const snap = await db.collection('userSessions')
      .where('uid', '==', auth.uid)
      .where('revokedAt', '==', null)
      .orderBy('lastUsedAt', 'desc')
      .limit(100)
      .get();

    const sessions = snap.docs.map(d => {
      const data = d.data();
      return {
        sessionId: d.id,
        deviceLabel: data.deviceLabel,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString() || null
      };
    });

    res.json({ sessions });
  } catch (err) {
    if (err.statusCode) { sendError(res, err.statusCode, err.message); return; }
    logger.error('listSessions error:', err.message);
    sendError(res, 500, 'Internal error');
  }
});

const revokeSession = onRequest({ cors: false }, async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { sendError(res, 405, 'POST required'); return; }
  try {
    const auth = await resolveFirebaseIdToken(extractBearer(req));
    const { sessionId, all } = req.body || {};
    const db = admin.firestore();

    if (all) {
      const snap = await db.collection('userSessions')
        .where('uid', '==', auth.uid)
        .where('revokedAt', '==', null)
        .get();
      const batch = db.batch();
      const now = admin.firestore.FieldValue.serverTimestamp();
      snap.docs.forEach(d => batch.update(d.ref, { revokedAt: now }));
      await batch.commit();
      res.json({ revokedCount: snap.size });
      return;
    }

    if (!sessionId) { sendError(res, 400, 'sessionId or all=true is required'); return; }
    const ref = db.doc(`userSessions/${sessionId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data().uid !== auth.uid) {
      sendError(res, 404, 'Session not found');
      return;
    }
    await ref.update({ revokedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (err) {
    if (err.statusCode) { sendError(res, err.statusCode, err.message); return; }
    logger.error('revokeSession error:', err.message);
    sendError(res, 500, 'Internal error');
  }
});

function extractBearer(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    throw authError('Missing Authorization header', 401);
  }
  return h.substring('Bearer '.length).trim();
}

module.exports = {
  startDeviceAuth,
  pollDeviceAuth,
  authorizeDevice,
  listSessions,
  revokeSession
};
