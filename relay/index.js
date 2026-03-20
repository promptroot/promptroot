/**
 * promptroot-relay — WebSocket relay between PromptRoot Cloud Functions and Brace agents.
 *
 * Brace connects outbound via WebSocket (no tunnel/port-forwarding needed).
 * Cloud Functions submit jobs and poll results via HTTP.
 *
 * WebSocket auth:  Authorization: Bearer pra_...  (agent token, validated via agentKeysByHash)
 * HTTP auth:       Authorization: Bearer {RELAY_SHARED_SECRET}
 *
 * HTTP routes (called by Cloud Functions):
 *   POST /:uid/prompt             — submit a job for a uid, returns { jobId }
 *   GET  /:uid/prompt/:jobId      — poll job result
 *   GET  /health                  — health check
 */

import { createServer } from 'http';
import { createHash } from 'crypto';
import { WebSocketServer } from 'ws';
import admin from 'firebase-admin';

const PORT = process.env.PORT || 8080;
const RELAY_SECRET = process.env.RELAY_SHARED_SECRET;
const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
  return snap.data().uid;
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

// --- HTTP server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ['uid', 'prompt'] or ['uid', 'prompt', 'jobId']

  // Health check — no auth required
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, connections: connections.size, jobs: jobs.size });
  }

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

  let uid;
  try {
    uid = await validateAgentToken(token);
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

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
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
    } catch (e) {
      console.error('[relay] Bad message from Brace:', e.message);
    }
  });

  ws.on('close', () => {
    if (connections.get(uid) === ws) connections.delete(uid);
    console.log(`[relay] Brace disconnected uid=${uid} (connections=${connections.size})`);
  });

  ws.on('error', (err) => {
    console.error(`[relay] WebSocket error uid=${uid}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[relay] Listening on port ${PORT}`);
});
