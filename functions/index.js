const functions = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

function formatJulesError(error, statusCode) {
  return 'Failed to create Jules session. Most likely causes: (1) API rate limit - wait a few minutes, (2) Invalid API key - check your settings, (3) Repository access - verify permissions.';
}

async function decryptJulesKeyBase64(b64, uid) {
  try {
    const enc = Buffer.from(b64, "base64");
    const encView = enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength);
    const te = new TextEncoder();
    const td = new TextDecoder();

    const paddedKeyString = (uid + '\0'.repeat(32)).slice(0, 32);
    const keyBytes = te.encode(paddedKeyString);
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    const ivBytes = te.encode(uid.slice(0, 12).padEnd(12, "0")).slice(0, 12);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encView);

    return td.decode(plainBuf);
  } catch (error) {
    console.error("Decryption error:", error.message);
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

    const encryptedBase64 = snap.data().key;
    if (!encryptedBase64) {
      throw new functions.https.HttpsError("failed-precondition", "Stored key is missing or invalid");
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
    } catch (e) {
      console.error("Decryption failed for user:", uid);
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
      console.error("Network error calling Jules:", e.message);
      throw new functions.https.HttpsError("unavailable", "Failed to reach Jules API");
    }

    if (!r.ok) {
      console.error("Jules API error:", r.status, json);
      const errorMessage = formatJulesError(json.error, r.status);
      throw new functions.https.HttpsError("permission-denied", errorMessage);
    }

    if (!json || !json.url) {
      console.error("Jules response missing url:", json);
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
        console.log(`Session ${sessionId} tracked in Firestore for user ${context.auth.uid}`);
      } else {
        console.warn('Could not extract sessionId from Jules response:', json);
      }
    } catch (trackError) {
      console.error('Failed to track session:', trackError.message);
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
    console.error("Error in runJules:", error.message);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create Jules session");
  }
});

exports.runJulesHttp = functions.https.onRequest(async (req, res) => {
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

    const encryptedBase64 = snap.data().key;
    if (!encryptedBase64) {
      res.status(400).json({ error: 'Stored key is missing or invalid' });
      return;
    }

    let julesKey;
    try {
      julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);
    } catch (e) {
      console.error('Decryption failed:', e.message);
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
      console.error('Network error calling Jules:', e.message);
      res.status(503).json({ error: 'Failed to reach Jules API' });
      return;
    }

    if (!r.ok) {
      console.error('Jules API error:', r.status, 'Full response:', JSON.stringify(json));
      const errorMessage = formatJulesError(json.error || json, r.status);
      res.status(502).json({ error: errorMessage });
      return;
    }

    if (!json || !json.url) {
      console.error('Jules response missing url:', json);
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
        console.log(`Session ${sessionId} tracked in Firestore for user ${uid}`);
      } else {
        console.warn('Could not extract sessionId from Jules response:', json);
      }
    } catch (trackError) {
      console.error('Failed to track session:', trackError.message);
      // Don't fail the request if tracking fails
    }

    // Return properly formatted Jules URL
    const sessionUrl = sessionId 
      ? `https://jules.google.com/session/${sessionId}`
      : json.url; // fallback to raw URL if sessionId extraction failed
    
    res.json({ sessionUrl, sessionId: sessionId || null });

  } catch (error) {
    console.error('Error in runJulesHttp:', error.message);
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

    const encryptedBase64 = snap.data().key;
    const julesKey = await decryptJulesKeyBase64(encryptedBase64, uid);

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
      console.error('GitHub OAuth credentials not configured');
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
      console.error('GitHub OAuth error:', tokenData.error_description);
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
    console.error('Error in githubOAuthExchange:', error);
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
    console.error('Error in getGitHubUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

exports.activateScheduledQueueItems = onSchedule('every 1 minutes', async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  
  console.log('Running scheduled queue activation check at', now.toDate().toISOString());
  
  try {
    const scheduledItemsSnapshot = await db.collectionGroup('items')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get();
    
    if (scheduledItemsSnapshot.empty) {
      console.log('No scheduled items found to activate.');
      console.log('Activation check complete. Total items activated: 0');
      return null;
    }
    
    console.log(`Found ${scheduledItemsSnapshot.size} scheduled items across all users.`);
    
    let totalActivated = 0;
    
    for (const doc of scheduledItemsSnapshot.docs) {
      const userId = doc.ref.parent?.parent?.id;
      if (!userId) {
        console.error(`Could not determine user ID for item ${doc.id}`);
        continue;
      }
      
      const item = doc.data();
      console.log(`Processing scheduled item ${doc.id} for user ${userId}`);
      
      try {
        const keySnap = await db.doc(`julesKeys/${userId}`).get();
        if (!keySnap.exists) {
          console.error(`No Jules API key found for user ${userId}`);
          await doc.ref.update({
            status: 'error',
            error: 'No Jules API key configured',
            updatedAt: now
          });
          continue;
        }
        
        const encryptedBase64 = keySnap.data().key;
        const julesKey = await decryptJulesKeyBase64(encryptedBase64, userId);
        
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
          
          console.log(`Successfully executed single prompt for item ${doc.id}`);
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
          
          console.log(`Successfully executed first subtask for item ${doc.id}, ${newRemaining.length} remaining`);
          totalActivated++;
        }
        
      } catch (err) {
        console.error(`Error processing item ${doc.id}:`, err);
        
        const retryCount = item.retryCount || 0;
        const maxRetries = 3;
        
        if (item.retryOnFailure && retryCount < maxRetries) {
          const newScheduledAt = new admin.firestore.Timestamp(
            now.seconds + 600,
            now.nanoseconds
          );
          
          console.log(`Scheduling retry ${retryCount + 1}/${maxRetries} for item ${doc.id} in 10 minutes`);
          
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
    
    console.log(`Activation check complete. Total items processed: ${totalActivated}`);
    return null;
  } catch (error) {
    console.error('Error in activateScheduledQueueItems:', error);
    return null;
  }
});
