const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { webcrypto: crypto } = require('crypto');

admin.initializeApp();

function formatJulesError(error, statusCode) {
  return 'Failed to create Jules session. Most likely causes: (1) API rate limit - wait a few minutes, (2) Invalid API key - check your settings, (3) Repository access - verify permissions.';
}

async function decryptJulesKey(docData, uid) {
  try {
    const encryptedBase64 = docData.key;
    if (!encryptedBase64) throw new Error("Missing encrypted key data");

    const te = new TextEncoder();
    const td = new TextDecoder();

    // Check for New Scheme (Random IV + PBKDF2)
    if (docData.iv && docData.salt) {
      // Frontend uses: btoa(String.fromCharCode(...new Uint8Array(data)))
      // So we need to reverse this: Buffer.from(base64, 'base64')
      const iv = new Uint8Array(Buffer.from(docData.iv, "base64"));
      const salt = new Uint8Array(Buffer.from(docData.salt, "base64"));
      const ciphertext = new Uint8Array(Buffer.from(encryptedBase64, "base64"));

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        te.encode(uid),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const plainBuf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
      );

      return td.decode(plainBuf);
    }

    // Fallback to Legacy Scheme (Deterministic IV + Padded Key)
    const enc = Buffer.from(encryptedBase64, "base64");
    const encView = new Uint8Array(enc.buffer, enc.byteOffset, enc.byteLength);

    const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyBytes = te.encode(paddedKeyString);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encView);

    return td.decode(plainBuf);
  } catch (error) {
    logger.error("Decryption error details:", {
      message: error.message,
      stack: error.stack,
      hasIvSalt: !!(docData.iv && docData.salt),
      keyLength: docData.key?.length || 0,
      uid: uid?.substring(0, 8) + '...' // Only log first 8 chars for privacy
    });
    throw new Error("Failed to decrypt Jules API key");
  }
}

exports.runJules = functions.https.onCall(async (data, context) => {
  let uid = context.auth?.uid;
  
  if (!uid && context.rawRequest?.headers) {
    try {
      const authHeader = context.rawRequest.headers['x-auth-token'];
      if (authHeader) {
        const decodedToken = await admin.auth().verifyIdToken(authHeader);
        uid = decodedToken.uid;
      }
    } catch (e) {}
  }

  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in to use Jules");
  }

  const promptText = (data && data.promptText) || "";
  const sourceId = (data && data.sourceId) || "sources/github/promptroot/promptroot";
  const branch = (data && data.branch) || "main";

  if (!promptText || typeof promptText !== "string" || promptText.trim() === "") {
    throw new functions.https.HttpsError("invalid-argument", "Prompt text is required");
  }

  if (!sourceId || typeof sourceId !== "string" || !sourceId.startsWith("sources/github/")) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid sourceId format");
  }

  try {
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "No Jules API key stored. Please save your API key first.");
    }

    const docData = snap.data();
    if (!docData.key) {
      throw new functions.https.HttpsError("failed-precondition", "Stored key is missing or invalid");
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKey(docData, uid);
    } catch (e) {
      logger.error("Decryption failed for user:", uid);
      throw new functions.https.HttpsError("internal", "Failed to decrypt Jules API key");
    }

    const julesBody = {
      title: (data && data.title) || 'Unnamed Session',
      prompt: promptText,
      sourceContext: {
        source: sourceId,
        githubRepoContext: { startingBranch: branch }
      }
    };

    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      logger.error("Network error calling Jules:", e.message);
      throw new functions.https.HttpsError("unavailable", "Failed to reach Jules API");
    }

    if (!r.ok) {
      logger.error("Jules API error:", r.status, json);
      const errorMessage = formatJulesError(json.error, r.status);
      throw new functions.https.HttpsError("permission-denied", errorMessage);
    }

    if (!json || !json.url) {
      logger.error("Jules response missing url:", json);
      throw new functions.https.HttpsError("internal", "Jules did not return a session URL");
    }

    // Extract session ID from the response (need it outside the try block)
    let sessionId = null;
    if (json.name && typeof json.name === 'string' && json.name.includes('sessions/')) {
      sessionId = json.name.split('sessions/')[1];
    } else if (json.id && typeof json.id === 'string' && json.id.includes('sessions/')) {
      sessionId = json.id.split('sessions/')[1];
    } else if (json.id && typeof json.id === 'string') {
      sessionId = json.id;
    } else if (json.url && typeof json.url === 'string' && json.url.includes('sessions/')) {
      const urlParts = json.url.split('sessions/');
      if (urlParts[1]) {
        sessionId = urlParts[1].split('?')[0];
      }
    }

    // Track session in Firestore
    try {
      if (sessionId && context.auth && context.auth.uid) {
        await db.doc(`juleSessions/${context.auth.uid}/sessions/${sessionId}`).set({
          sessionId: sessionId,
          sessionName: json.name || `sessions/${sessionId}`,
          promptPath: (data && data.promptPath) || null,
          promptContent: promptText,
          sourceId: sourceId,
          branch: branch,
          title: (data && data.title) || 'Unnamed Session',
          status: json.state || 'UNKNOWN',
          hasPR: false,
          prUrl: null,
          prTitle: null,
          prDescription: null,
          hasPlan: false,
          planStepCount: 0,
          failureStep: null,
          failureReason: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          queueItemId: (data && data.queueItemId) || null,
          userId: context.auth.uid
        });
        logger.info(`Session ${sessionId} tracked in Firestore for user ${context.auth.uid}`);
      } else {
        logger.warn('Could not extract sessionId from Jules response:', json);
      }
    } catch (trackError) {
      logger.error('Failed to track session:', trackError.message);
      // Don't fail the request if tracking fails
    }

    // Return properly formatted Jules URL
    const sessionUrl = sessionId 
      ? `https://jules.google.com/session/${sessionId}`
      : json.url; // fallback to raw URL if sessionId extraction failed
    
    return { sessionUrl };

  } catch (error) {
    if (error.code && error.code.startsWith("functions/")) {
      throw error;
    }
    logger.error("Error in runJules:", error.message);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create Jules session");
  }
});

exports.runJulesHttp = functions.https.onRequest(async (req, res) => {
  // Log incoming request for debugging
  logger.info('runJulesHttp called with:', {
    method: req.method,
    headers: Object.keys(req.headers),
    body: req.body,
    url: req.url
  });

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(400).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.info('Missing or invalid auth header:', authHeader);
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const idToken = authHeader.substring('Bearer '.length);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { promptText, sourceId, branch } = req.body || {};
    const source = sourceId || "sources/github/promptroot/promptroot";
    const startingBranch = branch || "main";


    if (!promptText || typeof promptText !== 'string' || promptText.trim() === '') {
      res.status(400).json({ error: 'promptText must be a non-empty string' });
      return;
    }

    if (!source || typeof source !== 'string' || !source.startsWith('sources/github/')) {
      res.status(400).json({ error: 'Invalid sourceId format' });
      return;
    }

    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      res.status(404).json({ error: 'No Jules API key stored. Please save your API key first.' });
      return;
    }

    const docData = snap.data();
    if (!docData.key) {
      res.status(400).json({ error: 'Stored key is missing or invalid' });
      return;
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKey(docData, uid);
    } catch (e) {
      logger.error('Decryption failed:', e.message);
      res.status(500).json({ error: 'Failed to decrypt Jules API key' });
      return;
    }

    const julesBody = {
      title: req.body.title || 'Unnamed Session',
      prompt: promptText,
      sourceContext: {
        source: source,
        githubRepoContext: { startingBranch: startingBranch }
      }
    };

    let r, json;
    try {
      r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
        body: JSON.stringify(julesBody)
      });
      json = await r.json();
    } catch (e) {
      logger.error('Network error calling Jules:', e.message);
      res.status(503).json({ error: 'Failed to reach Jules API' });
      return;
    }

    if (!r.ok) {
      logger.error('Jules API error:', r.status, 'Full response:', JSON.stringify(json));
      const errorMessage = formatJulesError(json.error || json, r.status);
      res.status(502).json({ error: errorMessage });
      return;
    }

    if (!json || !json.url) {
      logger.error('Jules response missing url:', json);
      res.status(500).json({ error: 'Jules did not return a session URL' });
      return;
    }

    // Extract session ID from the response (need it outside the try block)
    let sessionId = null;
    if (json.name && typeof json.name === 'string' && json.name.includes('sessions/')) {
      sessionId = json.name.split('sessions/')[1];
    } else if (json.id && typeof json.id === 'string' && json.id.includes('sessions/')) {
      sessionId = json.id.split('sessions/')[1];
    } else if (json.id && typeof json.id === 'string') {
      sessionId = json.id;
    } else if (json.url && typeof json.url === 'string' && json.url.includes('sessions/')) {
      const urlParts = json.url.split('sessions/');
      if (urlParts[1]) {
        sessionId = urlParts[1].split('?')[0];
      }
    }

    // Track session in Firestore
    try {
      if (sessionId && uid) {
        await db.collection('juleSessions').doc(uid).collection('sessions').doc(sessionId).set({
          sessionId: sessionId,
          sessionName: json.name || `sessions/${sessionId}`,
          promptPath: req.body.promptPath || null,
          promptContent: promptText,
          sourceId: source,
          branch: startingBranch,
          title: req.body.title || 'Unnamed Session',
          status: json.state || 'UNKNOWN',
          hasPR: false,
          prUrl: null,
          prTitle: null,
          prDescription: null,
          hasPlan: false,
          planStepCount: 0,
          failureStep: null,
          failureReason: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          queueItemId: req.body.queueItemId || null,
          userId: uid
        });
        logger.info(`Session ${sessionId} tracked in Firestore for user ${uid}`);
      } else {
        logger.warn('Could not extract sessionId from Jules response:', json);
      }
    } catch (trackError) {
      logger.error('Failed to track session:', trackError.message);
      // Don't fail the request if tracking fails
    }

    // Return properly formatted Jules URL
    const sessionUrl = sessionId 
      ? `https://jules.google.com/session/${sessionId}`
      : json.url; // fallback to raw URL if sessionId extraction failed
    
    res.json({ sessionUrl, sessionId: sessionId || null });

  } catch (error) {
    logger.error('Error in runJulesHttp:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

exports.validateJulesKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  try {
    const uid = context.auth.uid;
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      return { valid: false, message: "No Jules API key stored" };
    }

    const docData = snap.data();
    if (!docData.key) {
      return { valid: false, message: "Stored key is invalid" };
    }

    const julesKey = await decryptJulesKey(docData, uid);

    const r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
      method: "GET",
      headers: { "X-Goog-Api-Key": julesKey }
    });

    return {
      valid: r.ok,
      message: r.ok ? "API key is valid" : `Invalid key (HTTP ${r.status})`
    };

  } catch (error) {
    return { valid: false, message: `Validation error: ${error.message}` };
  }
});

exports.getJulesKeyInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  try {
    const uid = context.auth.uid;
    const db = admin.firestore();
    const snap = await db.doc(`julesKeys/${uid}`).get();

    if (!snap.exists) {
      return { hasKey: false };
    }

    const docData = snap.data();
    return {
      hasKey: true,
      storedAt: docData.storedAt ? docData.storedAt.toDate() : null,
      keyLength: (docData.key || "").length
    };

  } catch (error) {
    throw new functions.https.HttpsError("internal", `Error retrieving key info: ${error.message}`);
  }
});

exports.githubOAuthExchange = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(400).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { code, state } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    if (!state || !state.startsWith('extension-')) {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('GitHub OAuth credentials not configured');
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error('GitHub OAuth error:', tokenData.error_description);
      res.status(400).json({ 
        error: tokenData.error_description || 'Failed to exchange code for token' 
      });
      return;
    }

    if (!tokenData.access_token) {
      res.status(500).json({ error: 'No access token received from GitHub' });
      return;
    }

    res.json({
      access_token: tokenData.access_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type
    });

  } catch (error) {
    logger.error('Error in githubOAuthExchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

exports.getGitHubUser = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(400).json({ error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring('Bearer '.length);

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PromptRoot-WebClipper'
      }
    });

    if (!userResponse.ok) {
      res.status(userResponse.status).json({ error: 'Failed to fetch user info from GitHub' });
      return;
    }

    const userData = await userResponse.json();

    res.json({
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
      email: userData.email
    });

  } catch (error) {
    logger.error('Error in getGitHubUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== Agent Key Management =====
// In-memory rate limit state for agentApi (per Cloud Function instance)
const agentRateLimitMap = new Map(); // tokenHash → { count, windowStart }

/**
 * Compute SHA-256 hex of a string using Node's webcrypto.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', Buffer.from(str, 'utf8'));
  return Buffer.from(buf).toString('hex');
}

/**
 * Authenticate an agent API request by Bearer token.
 * Returns { uid } on success, throws with statusCode on failure.
 * Also updates lastUsedAt asynchronously.
 * @param {string} authHeader
 * @returns {Promise<{ uid: string, tokenHash: string }>}
 */
async function authenticateAgentToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.statusCode = 401;
    throw err;
  }
  const token = authHeader.substring('Bearer '.length).trim();
  if (!token.startsWith('pra_')) {
    const err = new Error('Invalid token format');
    err.statusCode = 401;
    throw err;
  }

  const tokenHash = await sha256Hex(token);
  const db = admin.firestore();
  const snap = await db.doc(`agentKeysByHash/${tokenHash}`).get();
  if (!snap.exists) {
    const err = new Error('Invalid or revoked token');
    err.statusCode = 401;
    throw err;
  }

  const { uid } = snap.data();

  // Fire-and-forget lastUsedAt update
  db.doc(`agentKeys/${uid}`).get().then(keySnap => {
    if (!keySnap.exists) return;
    const tokens = keySnap.data().tokens || [];
    const updated = tokens.map(t =>
      t.tokenHash === tokenHash
        ? { ...t, lastUsedAt: admin.firestore.FieldValue.serverTimestamp() }
        : t
    );
    return keySnap.ref.update({ tokens: updated });
  }).catch(() => {});

  return { uid, tokenHash };
}

/**
 * Check rate limit for a token. Returns true if allowed, false if exceeded.
 * 60 requests per minute per token (in-memory, per instance).
 * @param {string} tokenHash
 * @returns {boolean}
 */
function checkRateLimit(tokenHash) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 60;

  const entry = agentRateLimitMap.get(tokenHash);
  if (!entry || now - entry.windowStart >= windowMs) {
    agentRateLimitMap.set(tokenHash, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * manageAgentKeys: HTTP Cloud Function for agent key CRUD.
 * Auth: Firebase ID token (Bearer).
 * Actions: create, list, revoke.
 */
exports.manageAgentKeys = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return; }

  // Auth: Firebase ID token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  let uid;
  try {
    const idToken = authHeader.substring('Bearer '.length);
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid or expired ID token' });
    return;
  }

  const { action, tokenHash, label } = req.body || {};
  const db = admin.firestore();

  try {
    if (action === 'list') {
      const snap = await db.doc(`agentKeys/${uid}`).get();
      const tokens = snap.exists ? (snap.data().tokens || []) : [];
      // Convert server timestamps to ISO strings for transport
      const sanitized = tokens.map(t => ({
        tokenHash: t.tokenHash,
        label: t.label,
        createdAt: t.createdAt?.toDate?.()?.toISOString() || t.createdAt || null,
        lastUsedAt: t.lastUsedAt?.toDate?.()?.toISOString() || t.lastUsedAt || null
      }));
      res.json({ tokens: sanitized });
      return;
    }

    if (action === 'create') {
      if (!tokenHash || !label) {
        res.status(400).json({ error: 'tokenHash and label are required' });
        return;
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      const newToken = { tokenHash, label, createdAt: now, lastUsedAt: null };

      // Batch write: add to agentKeys array + create agentKeysByHash doc
      const batch = db.batch();
      const keysRef = db.doc(`agentKeys/${uid}`);
      const snap = await keysRef.get();
      if (snap.exists) {
        batch.update(keysRef, { tokens: admin.firestore.FieldValue.arrayUnion(newToken) });
      } else {
        batch.set(keysRef, { tokens: [newToken] });
      }
      batch.set(db.doc(`agentKeysByHash/${tokenHash}`), { uid, createdAt: now });
      await batch.commit();

      res.json({ ok: true });
      return;
    }

    if (action === 'revoke') {
      if (!tokenHash) {
        res.status(400).json({ error: 'tokenHash is required' });
        return;
      }
      const keysRef = db.doc(`agentKeys/${uid}`);
      const snap = await keysRef.get();
      if (snap.exists) {
        const tokens = snap.data().tokens || [];
        const toRemove = tokens.find(t => t.tokenHash === tokenHash);
        if (toRemove) {
          const batch = db.batch();
          batch.update(keysRef, { tokens: admin.firestore.FieldValue.arrayRemove(toRemove) });
          batch.delete(db.doc(`agentKeysByHash/${tokenHash}`));
          await batch.commit();
        }
      }
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error) {
    logger.error('manageAgentKeys error:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * agentApi: HTTP Cloud Function serving the PromptRoot Agent REST API.
 * Auth: Bearer agent token (pra_...) — validated via agentKeysByHash lookup.
 * Rate limit: 60 req/min per token (in-memory per instance).
 */
exports.agentApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  // Authenticate
  let uid, tokenHash;
  try {
    ({ uid, tokenHash } = await authenticateAgentToken(req.headers.authorization));
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
    return;
  }

  // Rate limit
  if (!checkRateLimit(tokenHash)) {
    res.status(429).json({ error: 'Rate limit exceeded (60 req/min)' });
    return;
  }

  const db = admin.firestore();
  const path = req.path || '/';
  const method = req.method;

  try {
    // --- GET /prompts or GET /prompts?owner=...&repo=... ---
    if (path === '/prompts' && method === 'GET') {
      const owner = req.query.owner || 'promptroot';
      const repo = req.query.repo || 'promptroot';
      const branch = req.query.branch || 'main';
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const r = await fetch(apiUrl, { headers: { 'User-Agent': 'PromptRoot-AgentAPI' } });
      if (!r.ok) { res.status(r.status).json({ error: 'Failed to fetch prompt tree from GitHub' }); return; }
      const json = await r.json();
      const files = (json.tree || [])
        .filter(f => f.type === 'blob' && f.path.endsWith('.md'))
        .map(f => ({ path: f.path, size: f.size }));
      res.json({ data: files });
      return;
    }

    // --- POST /prompts/render ---
    if (path === '/prompts/render' && method === 'POST') {
      const { promptPath, variables = {}, owner = 'promptroot', repo = 'promptroot', branch = 'main' } = req.body || {};
      if (!promptPath) { res.status(400).json({ error: 'promptPath is required' }); return; }
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${promptPath}`;
      const r = await fetch(rawUrl);
      if (!r.ok) { res.status(r.status).json({ error: 'Prompt not found' }); return; }
      let content = await r.text();
      // Simple variable substitution: replace {VAR_NAME} with provided values
      content = content.replace(/\{([A-Z0-9_-]+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
      res.json({ data: { content } });
      return;
    }

    // --- GET /prompts/* (fetch single prompt raw) ---
    if (path.startsWith('/prompts/') && method === 'GET') {
      const promptPath = path.substring('/prompts/'.length);
      const owner = req.query.owner || 'promptroot';
      const repo = req.query.repo || 'promptroot';
      const branch = req.query.branch || 'main';
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${promptPath}`;
      const r = await fetch(rawUrl);
      if (!r.ok) { res.status(r.status).json({ error: 'Prompt not found' }); return; }
      const content = await r.text();
      res.json({ data: { path: promptPath, content } });
      return;
    }

    // --- GET /queue ---
    if (path === '/queue' && method === 'GET') {
      const snap = await db.collection(`julesQueues/${uid}/items`).orderBy('createdAt', 'desc').limit(100).get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() }));
      res.json({ data: items });
      return;
    }

    // --- POST /queue ---
    if (path === '/queue' && method === 'POST') {
      const { prompt, sourceId, branch, title, type = 'single' } = req.body || {};
      if (!prompt) { res.status(400).json({ error: 'prompt is required' }); return; }
      const ref = await db.collection(`julesQueues/${uid}/items`).add({
        prompt, sourceId, branch, title, type,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ data: { id: ref.id } });
      return;
    }

    // --- PATCH /queue/:id ---
    if (path.startsWith('/queue/') && method === 'PATCH') {
      const itemId = path.substring('/queue/'.length);
      if (!itemId) { res.status(400).json({ error: 'itemId is required' }); return; }
      // Allowlist writable fields — prevent overwriting internal fields (userId, createdAt, etc.)
      const ALLOWED_PATCH_FIELDS = ['status', 'prompt', 'title', 'sourceId', 'branch', 'scheduledAt', 'result', 'error', 'type', 'remaining', 'retryOnFailure'];
      const body = req.body || {};
      const updates = {};
      for (const key of ALLOWED_PATCH_FIELDS) {
        if (key in body) updates[key] = body[key];
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: `No valid fields to update. Allowed: ${ALLOWED_PATCH_FIELDS.join(', ')}` });
        return;
      }
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await db.doc(`julesQueues/${uid}/items/${itemId}`).update(updates);
      res.json({ data: { ok: true } });
      return;
    }

    // --- DELETE /queue/:id ---
    if (path.startsWith('/queue/') && method === 'DELETE') {
      const itemId = path.substring('/queue/'.length);
      await db.doc(`julesQueues/${uid}/items/${itemId}`).delete();
      res.json({ data: { ok: true } });
      return;
    }

    // --- GET /sessions ---
    if (path === '/sessions' && method === 'GET') {
      const snap = await db.collection(`juleSessions/${uid}/sessions`).orderBy('createdAt', 'desc').limit(50).get();
      const sessions = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString(),
        completedAt: d.data().completedAt?.toDate?.()?.toISOString()
      }));
      res.json({ data: sessions });
      return;
    }

    // --- GET /webclips ---
    if (path === '/webclips' && method === 'GET') {
      const owner = req.query.owner || 'promptroot';
      const repo = req.query.repo || 'promptroot';
      const branch = req.query.branch || 'web-captures';
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/webclips/${uid}?ref=${branch}`;
      const r = await fetch(apiUrl, { headers: { 'User-Agent': 'PromptRoot-AgentAPI' } });
      if (r.status === 404) { res.json({ data: [] }); return; }
      if (!r.ok) { res.status(r.status).json({ error: 'Failed to fetch webclips' }); return; }
      const files = await r.json();
      res.json({ data: Array.isArray(files) ? files.map(f => ({ name: f.name, path: f.path, sha: f.sha })) : [] });
      return;
    }

    // --- 404 ---
    res.status(404).json({ error: `No route: ${method} ${path}` });

  } catch (error) {
    logger.error('agentApi error:', error.message, { path, method, uid });
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

exports.activateScheduledQueueItems = onSchedule('every 1 minutes', async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  
  logger.debug('Running scheduled queue activation check at', now.toDate().toISOString());
  
  try {
    const scheduledItemsSnapshot = await db.collectionGroup('items')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();
    
    if (scheduledItemsSnapshot.empty) {
      logger.debug('No scheduled items found to activate.');
      logger.debug('Activation check complete. Total items activated: 0');
      return null;
    }
    
    logger.info(`Found ${scheduledItemsSnapshot.size} scheduled items across all users.`);
    
    let totalActivated = 0;
    
    for (const doc of scheduledItemsSnapshot.docs) {
      const userId = doc.ref.parent?.parent?.id;
      if (!userId) {
        logger.error(`Could not determine user ID for item ${doc.id}`);
        continue;
      }
      
      const item = doc.data();
      logger.info(`Processing scheduled item ${doc.id} for user ${userId}`);
      
      try {
        const keySnap = await db.doc(`julesKeys/${userId}`).get();
        if (!keySnap.exists) {
          logger.error(`No Jules API key found for user ${userId}`);
          await doc.ref.update({
            status: 'error',
            error: 'No Jules API key configured',
            updatedAt: now
          });
          continue;
        }
        
        const docData = keySnap.data();
        if (!docData.key) {
           logger.error(`Jules API key empty/invalid for user ${userId}`);
           await doc.ref.update({
             status: 'error',
             error: 'Jules API key invalid',
             updatedAt: now
           });
           continue;
        }

        const julesKey = await decryptJulesKey(docData, userId);
        
        if (item.type === 'single') {
          await doc.ref.update({ status: 'in-progress', updatedAt: now });
          
          const julesBody = {
            title: `${item.prompt?.substring(0, 50) || 'Untitled'}`,
            prompt: item.prompt,
            sourceContext: {
              source: item.sourceId,
              githubRepoContext: { startingBranch: item.branch || 'master' }
            }
          };
          
          const r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
            body: JSON.stringify(julesBody)
          });
          
          const json = await r.json();
          
          if (!r.ok || json.error) {
            const errorMessage = formatJulesError(json.error, r.status);
            throw new Error(errorMessage);
          }
          
          await doc.ref.delete();
          
          logger.info(`Successfully executed single prompt for item ${doc.id}`);
          totalActivated++;
          
        } else if (item.type === 'subtasks' && Array.isArray(item.remaining) && item.remaining.length > 0) {
          await doc.ref.update({ status: 'in-progress', updatedAt: now });
          
          const subtask = item.remaining[0];
          const julesBody = {
            title: `${subtask.fullContent?.substring(0, 50) || 'Untitled'}`,
            prompt: subtask.fullContent,
            sourceContext: {
              source: item.sourceId,
              githubRepoContext: { startingBranch: item.branch || 'master' }
            }
          };
          
          const r = await fetch("https://jules.googleapis.com/v1alpha/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": julesKey },
            body: JSON.stringify(julesBody)
          });
          
          const json = await r.json();
          
          if (!r.ok || json.error) {
            const errorMessage = formatJulesError(json.error, r.status);
            throw new Error(errorMessage);
          }
          
          const newRemaining = item.remaining.slice(1);
          if (newRemaining.length === 0) {
            await doc.ref.delete();
          } else {
            await doc.ref.update({
              remaining: newRemaining,
              status: 'pending',
              updatedAt: now
            });
          }
          
          logger.info(`Successfully executed first subtask for item ${doc.id}, ${newRemaining.length} remaining`);
          totalActivated++;
        }
        
      } catch (err) {
        logger.error(`Error processing item ${doc.id}:`, err);
        
        const retryCount = item.retryCount || 0;
        const maxRetries = 3;
        
        if (item.retryOnFailure && retryCount < maxRetries) {
          const newScheduledAt = new admin.firestore.Timestamp(
            now.seconds + 600,
            now.nanoseconds
          );
          
          logger.info(`Scheduling retry ${retryCount + 1}/${maxRetries} for item ${doc.id} in 10 minutes`);
          
          await doc.ref.update({
            status: 'scheduled',
            scheduledAt: newScheduledAt,
            retryCount: retryCount + 1,
            lastError: err.message,
            lastAttemptAt: now,
            updatedAt: now
          });
        } else {
          const errorMessage = item.retryOnFailure 
            ? `Failed after ${retryCount} retries: ${err.message}`
            : err.message;
          
          await doc.ref.update({
            status: 'error',
            error: errorMessage,
            updatedAt: now
          });
        }
      }
    }
    
    logger.info(`Activation check complete. Total items processed: ${totalActivated}`);
    return null;
  } catch (error) {
    logger.error('Error in activateScheduledQueueItems:', error);
    return null;
  }
});

/**
 * Exchange VS Code GitHub token for Firebase custom token
 * Used by VS Code extension for authentication
 */
exports.exchangeVSCodeGitHubToken = onCall(async (request) => {
  const { githubToken } = request.data;

  logger.info('exchangeVSCodeGitHubToken called');
  logger.info('Data received:', JSON.stringify(request.data));
  logger.info('githubToken extracted:', githubToken ? `${githubToken.substring(0, 10)}...` : 'null/undefined');

  if (!githubToken) {
    logger.error('No githubToken in data');
    throw new functions.https.HttpsError('invalid-argument', 'GitHub token is required');
  }

  try {
    // Verify GitHub token and get user info
    const githubResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Promptroot-VSCode-Extension'
      }
    });

    if (!githubResponse.ok) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        `GitHub API returned ${githubResponse.status}: ${githubResponse.statusText}`
      );
    }

    const githubUser = await githubResponse.json();
    logger.info('GitHub user:', { id: githubUser.id, login: githubUser.login, email: githubUser.email });
    
    // Use a fallback email if GitHub email is null or private
    const userEmail = githubUser.email || `${githubUser.login}@users.noreply.github.com`;
    
    let uid;
    let existingUser = null;
    
    try {
      // First, try to find existing web app user by GitHub provider ID
      logger.info('Searching for existing web app user...');
      const users = await admin.auth().listUsers();
      const webAppUser = users.users.find(user => 
        user.providerData.some(provider => 
          provider.providerId === 'github.com' && 
          provider.uid === githubUser.id.toString()
        )
      );
      
      if (webAppUser) {
        logger.info('Found existing web app user:', webAppUser.uid);
        uid = webAppUser.uid;
        existingUser = webAppUser;
      } else {
        // Fallback to VS Code extension format
        logger.info('No existing web app user found, using extension format');
        uid = `github:${githubUser.id}`;
      }
    } catch (error) {
      logger.info('Error searching for existing user, using extension format:', error);
      uid = `github:${githubUser.id}`;
    }
    
    // If no web app user found, try to get/create VS Code extension user
    if (!existingUser) {
      try {
        existingUser = await admin.auth().getUser(uid);
        logger.info('Existing extension user found:', existingUser.uid);
      } catch (error) {
        // User doesn't exist, create them
        logger.info('Creating new user with uid:', uid, 'email:', userEmail);
        await admin.auth().createUser({
          uid,
          email: userEmail,
          displayName: githubUser.name || githubUser.login,
          photoURL: githubUser.avatar_url,
          emailVerified: true
        });
        logger.info('User created successfully');
      }
    }

    // Create custom token
    const customToken = await admin.auth().createCustomToken(uid, {
      github_id: githubUser.id,
      github_login: githubUser.login,
      provider: 'github.com'
    });

    logger.info('Custom token created successfully');

    return {
      customToken,
      user: {
        uid,
        email: userEmail,
        displayName: githubUser.name || githubUser.login,
        photoURL: githubUser.avatar_url
      }
    };
  } catch (error) {
    logger.error('Token exchange error:', error);
    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to exchange token'
    );
  }
});

// ===== OpenClaw Gateway Functions =====

/**
 * Decrypt the OpenClaw gateway token from Firestore.
 * Reuses the same PBKDF2 + AES-GCM scheme as decryptJulesKey.
 */
async function decryptOpenclawToken(docData, uid) {
  return decryptJulesKey(docData, uid);
}

/**
 * Verify Firebase ID token from Authorization header and return uid.
 */
async function verifyIdToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) throw new Error('Missing authorization token');
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded.uid;
}

/**
 * callOpenclawGateway — proxies a prompt to the user's OpenClaw gateway.
 * Reads openclawKeys/{uid}, decrypts token, routes via relay or direct URL.
 * Returns { jobId }.
 */
exports.callOpenclawGateway = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const uid = await verifyIdToken(req);
    const { text, slug } = req.body || {};
    if (!text) { res.status(400).json({ error: 'text is required' }); return; }

    const firestore = admin.firestore();
    const snap = await firestore.doc(`openclawKeys/${uid}`).get();
    if (!snap.exists) { res.status(412).json({ error: 'OpenClaw not configured' }); return; }

    const docData = snap.data();
    const token = await decryptOpenclawToken(docData, uid);

    let gatewayUrl;
    let authToken = token;

    if (docData.useRelay) {
      // Phase 3b: route via relay
      const relaySecret = process.env.RELAY_SHARED_SECRET;
      if (!relaySecret) { res.status(503).json({ error: 'Relay not configured on server' }); return; }
      gatewayUrl = `https://relay.promptroot.io/${uid}/prompt`;
      authToken = relaySecret;
    } else {
      // Phase 3a: direct Cloudflare Tunnel
      gatewayUrl = docData.gatewayUrl;
      if (!gatewayUrl) { res.status(412).json({ error: 'Gateway URL not configured' }); return; }
      gatewayUrl = gatewayUrl.replace(/\/$/, '') + '/api/prompt';
    }

    const gwRes = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ text, source: 'promptroot', slug: slug || null })
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text().catch(() => '');
      logger.error('Gateway error', gwRes.status, errText);
      if (gwRes.status === 401) { res.status(401).json({ error: 'Gateway rejected token. Re-enter your credentials.' }); return; }
      if (gwRes.status === 503) { res.status(503).json({ error: 'Bliz is unreachable. Is your tunnel running?' }); return; }
      res.status(502).json({ error: `Gateway returned ${gwRes.status}` }); return;
    }

    const gwData = await gwRes.json();
    if (!gwData.jobId) { res.status(502).json({ error: 'Gateway did not return a jobId' }); return; }

    res.json({ jobId: gwData.jobId });
  } catch (err) {
    logger.error('callOpenclawGateway error:', err.message);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

/**
 * pollOpenclawJob — polls the OpenClaw gateway for a job result.
 * Returns { status: 'pending'|'complete'|'error'|'not_found', output? }.
 */
exports.pollOpenclawJob = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const uid = await verifyIdToken(req);
    const { jobId } = req.body || {};
    if (!jobId) { res.status(400).json({ error: 'jobId is required' }); return; }

    const firestore2 = admin.firestore();
    const snap = await firestore2.doc(`openclawKeys/${uid}`).get();
    if (!snap.exists) { res.status(412).json({ error: 'OpenClaw not configured' }); return; }

    const docData = snap.data();
    const token = await decryptOpenclawToken(docData, uid);

    let pollUrl;
    let authToken = token;

    if (docData.useRelay) {
      const relaySecret = process.env.RELAY_SHARED_SECRET;
      if (!relaySecret) { res.status(503).json({ error: 'Relay not configured on server' }); return; }
      pollUrl = `https://relay.promptroot.io/${uid}/prompt/${jobId}`;
      authToken = relaySecret;
    } else {
      const gatewayUrl = (docData.gatewayUrl || '').replace(/\/$/, '');
      if (!gatewayUrl) { res.status(412).json({ error: 'Gateway URL not configured' }); return; }
      pollUrl = `${gatewayUrl}/api/prompt/${encodeURIComponent(jobId)}`;
    }

    const gwRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (gwRes.status === 404) { res.json({ status: 'not_found' }); return; }
    if (!gwRes.ok) { res.status(502).json({ error: `Gateway returned ${gwRes.status}` }); return; }

    const gwData = await gwRes.json();
    res.json({
      status: gwData.status || 'pending',
      output: gwData.output || null
    });
  } catch (err) {
    logger.error('pollOpenclawJob error:', err.message);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});
