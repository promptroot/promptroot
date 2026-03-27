/**
 * promptroot-relay — WebSocket relay between PromptRoot / brace-ui and Brace agents.
 *
 * Brace connects outbound via WebSocket (no tunnel/port-forwarding needed).
 * Cloud Functions and brace-ui submit jobs and poll results via HTTP.
 *
 * Auth model:
 *   WebSocket (Brace → relay):  Authorization: Bearer pra_...  (agent token, validated via agentKeysByHash)
 *   HTTP (callers → relay):     Authorization: Bearer pra_...  (same agent token)
 *   Legacy HTTP (Cloud Fns):    Authorization: Bearer {RELAY_SHARED_SECRET}
 *
 * OAuth vs API key:
 *   Both are supported. OAuth (Claude.ai Pro/Max) is recommended — the OpenClaw plugin
 *   routes all requests through subagent.run() which works with OAuth. An Anthropic API
 *   key is not required but can be added as a fallback for cost management.
 *
 * HTTP routes:
 *   GET  /v1/models               — list available models (returns [{id: "brace"}])
 *   POST /v1/chat/completions     — OpenAI-compatible chat endpoint (proxied to Brace)
 *   POST /:uid/prompt             — legacy: submit a job for a uid, returns { jobId }
 *   GET  /:uid/prompt/:jobId      — legacy: poll job result
 *   GET  /health                  — health check
 */

import { createServer } from 'http';
import { createHash } from 'crypto';
import { WebSocketServer } from 'ws';
import admin from 'firebase-admin';

const PORT = process.env.PORT || 8080;
const RELAY_SECRET = process.env.RELAY_SHARED_SECRET;
const JOB_TTL_MS = 10 * 60 * 1000;        // 10 minutes
const OAI_TIMEOUT_MS = 5 * 60 * 1000;     // 5 minutes for non-streaming completions

// --- Firebase init ---
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('[relay] FIREBASE_SERVICE_ACCOUNT env var is required');
  process.exit(1);
}
if (!RELAY_SECRET) {
  console.error('[relay] RELAY_SHARED_SECRET env var is required');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

// --- In-memory state ---
// uid → WebSocket (most recent connection wins)
const connections = new Map();
// jobId → { uid, status, result, error, createdAt }
const jobs = new Map();
// requestId → { res, streaming, timer }
const oaiRequests = new Map();

// Purge stale jobs every minute
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [jobId, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(jobId);
  }
}, 60_000);

// --- Token validation ---
async function validateAgentToken(token) {
  const hash = createHash('sha256').update(token).digest('hex');
  const snap = await db.doc(`agentKeysByHash/${hash}`).get();
  if (!snap.exists) return null;
  return { uid: snap.data().uid, tokenHash: hash };
}

async function setRelayStatus(uid, connected) {
  try {
    await db.doc(`relayStatus/${uid}`).set({
      connected,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  } catch (err) {
    console.error('[relay] Failed to set relayStatus:', err.message);
  }
}

async function updateLastUsed(uid, tokenHash) {
  try {
    const ref = db.doc(`agentKeys/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) return;
    const tokens = (snap.data().tokens || []).map(t =>
      t.tokenHash === tokenHash
        ? { ...t, lastUsedAt: admin.firestore.Timestamp.now() }
        : t
    );
    await ref.update({ tokens });
  } catch (err) {
    console.error('[relay] Failed to update lastUsedAt:', err.message);
  }
}

function parseBearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateRequestId() {
  return `oai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- HTTP server ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ['uid', 'prompt'] or ['uid', 'prompt', 'jobId']

  // CORS preflight — no auth required
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Inject CORS headers on all responses
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Health check — no auth required
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, connections: connections.size, jobs: jobs.size });
  }

  // ── OpenAI-compatible proxy routes (auth: pra_... agent token) ───────────────

  if (url.pathname === '/v1/models' && req.method === 'GET') {
    const token = parseBearer(req);
    if (!token) return json(res, 401, { error: 'Unauthorized' });
    const result = await validateAgentToken(token);
    if (!result) return json(res, 401, { error: 'Invalid token' });
    const { uid, tokenHash } = result;
    updateLastUsed(uid, tokenHash);
    return json(res, 200, {
      object: 'list',
      data: [{ id: 'brace', object: 'model', owned_by: 'openclaw' }],
    });
  }

  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    const token = parseBearer(req);
    if (!token) return json(res, 401, { error: 'Unauthorized' });
    const result = await validateAgentToken(token);
    if (!result) return json(res, 401, { error: 'Invalid token' });
    const { uid, tokenHash } = result;
    updateLastUsed(uid, tokenHash);

    const ws = connections.get(uid);
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      return json(res, 503, { error: 'No Brace instance connected' });
    }

    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

    const requestId = generateRequestId();
    const isStream = body.stream === true;

    if (isStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      // Store with no timer — streaming responses drive their own completion
      oaiRequests.set(requestId, { res, streaming: true, timer: null, uid });
      req.on('close', () => {
        oaiRequests.delete(requestId);
      });
    } else {
      const timer = setTimeout(() => {
        const pending = oaiRequests.get(requestId);
        if (pending) {
          oaiRequests.delete(requestId);
          json(res, 504, { error: 'Brace did not respond in time' });
        }
      }, OAI_TIMEOUT_MS);
      oaiRequests.set(requestId, { res, streaming: false, timer, uid });
    }

    ws.send(JSON.stringify({ type: 'openai', requestId, body }));
    console.log(`[relay] OpenAI request ${requestId} dispatched to uid=${uid} stream=${isStream}`);

    if (!isStream) return; // response delivered asynchronously via WebSocket handler
    return;
  }

  // ── Relay-secret routes (called by Cloud Functions) ──────────────────────────

  // All other routes require relay secret
  if (parseBearer(req) !== RELAY_SECRET) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  // POST /:uid/prompt — submit a job
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'prompt') {
    const uid = parts[0];
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Invalid JSON' }); }

    const { text, slug } = body;
    if (!text) return json(res, 400, { error: 'text is required' });

    const ws = connections.get(uid);
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      return json(res, 503, { error: 'agent_offline' });
    }

    const jobId = generateJobId();
    jobs.set(jobId, { uid, status: 'pending', result: null, error: null, createdAt: Date.now() });

    ws.send(JSON.stringify({ type: 'job', jobId, text, slug: slug || null }));
    console.log(`[relay] Job ${jobId} dispatched to uid=${uid}`);
    return json(res, 202, { jobId, status: 'pending' });
  }

  // GET /:uid/prompt/:jobId — poll a job
  if (req.method === 'GET' && parts.length === 3 && parts[1] === 'prompt') {
    const jobId = parts[2];
    const job = jobs.get(jobId);
    if (!job) return json(res, 404, { error: 'not_found' });

    const status = job.status === 'complete' ? 200 : 202;
    return json(res, status, { status: job.status, result: job.result, error: job.error });
  }

  return json(res, 404, { error: 'Not found' });
});

// --- WebSocket server (Brace connects here) ---
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
  const token = parseBearer(req);
  if (!token) {
    ws.close(4001, 'Missing token');
    return;
  }

  let uid, tokenHash;
  try {
    const result = await validateAgentToken(token);
    if (result) ({ uid, tokenHash } = result);
  } catch (err) {
    console.error('[relay] Token validation error:', err.message);
    ws.close(4500, 'Server error');
    return;
  }

  if (!uid) {
    ws.close(4003, 'Invalid token');
    return;
  }

  // Most recent connection wins (Brace reconnects after restart)
  const prev = connections.get(uid);
  if (prev && prev.readyState === 1) {
    prev.close(4000, 'Replaced by newer connection');
  }
  connections.set(uid, ws);
  console.log(`[relay] Brace connected uid=${uid} (connections=${connections.size})`);
  updateLastUsed(uid, tokenHash);
  setRelayStatus(uid, true);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // ── Prompt job results ────────────────────────────────────────────────
      if (msg.type === 'result' || (!msg.type && msg.jobId && 'result' in msg)) {
        const { jobId, result, error } = msg;
        const job = jobs.get(jobId);
        if (!job) {
          console.warn(`[relay] Result for unknown jobId=${jobId} from uid=${uid}`);
          return;
        }
        if (job.uid !== uid) {
          console.warn(`[relay] uid mismatch for jobId=${jobId}`);
          return;
        }
        job.status = error ? 'error' : 'complete';
        job.result = result ?? null;
        job.error = error ?? null;
        console.log(`[relay] Job ${jobId} ${job.status}`);
        return;
      }

      // ── OpenAI non-streaming response ─────────────────────────────────────
      if (msg.type === 'openai_response') {
        const { requestId, body } = msg;
        const pending = oaiRequests.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        oaiRequests.delete(requestId);
        if (pending.streaming) {
          // Client requested SSE but plugin returned a full JSON response — convert to SSE
          const chunk = {
            id: body.id || `chatcmpl_${requestId}`,
            object: 'chat.completion.chunk',
            created: body.created || Math.floor(Date.now() / 1000),
            model: body.model || 'brace',
            choices: [{
              index: 0,
              delta: { role: 'assistant', content: body.choices?.[0]?.message?.content || '' },
              finish_reason: null,
            }],
          };
          const doneChunk = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
          pending.res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          pending.res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
          pending.res.write('data: [DONE]\n\n');
          pending.res.end();
        } else {
          pending.res.writeHead(200, { 'Content-Type': 'application/json' });
          pending.res.end(JSON.stringify(body));
        }
        return;
      }


    } catch (e) {
      console.error('[relay] Bad message from Brace:', e.message);
    }
  });

  ws.on('close', () => {
    if (connections.get(uid) === ws) {
      connections.delete(uid);
      setRelayStatus(uid, false);
    }
    console.log(`[relay] Brace disconnected uid=${uid} (connections=${connections.size})`);
    // Fail any in-flight OpenAI requests belonging to this uid
    for (const [requestId, pending] of oaiRequests) {
      if (pending.uid !== uid) continue;
      oaiRequests.delete(requestId);
      if (pending.streaming) {
        try { pending.res.end(); } catch {}
      } else {
        clearTimeout(pending.timer);
        try { json(pending.res, 503, { error: 'Brace disconnected' }); } catch {}
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[relay] WebSocket error uid=${uid}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[relay] Listening on port ${PORT}`);
});
