/**
 * promptroot-gateway — OpenClaw plugin
 *
 * Exposes two HTTP endpoints so PromptRoot Cloud Functions can dispatch
 * prompts to Brace and poll for results:
 *
 *   POST /api/prompt          → { jobId, pollUrl }           (202 Accepted)
 *   GET  /api/prompt/:jobId   → { status }  or  { status, output, completedAt }
 *
 * Both routes are protected by gateway auth (Bearer OPENCLAW_GATEWAY_TOKEN).
 * Jobs are kept in-memory for 24 h then discarded.
 *
 * SDD-0002 Phase 0 / Phase 3a
 */

import { randomBytes } from "node:crypto";

// ─── Job store ───────────────────────────────────────────────────────────────

/**
 * @type {Map<string, {
 *   status: 'pending' | 'complete' | 'error',
 *   createdAt: string,
 *   slug: string | null,
 *   output?: string,
 *   completedAt?: string,
 *   error?: string,
 * }>}
 */
const jobs = new Map();

function scheduleExpiry(jobId, ttlMs) {
  setTimeout(() => jobs.delete(jobId), ttlMs).unref();
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function readBody(req, maxBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

// ─── Response extraction ──────────────────────────────────────────────────────

/**
 * Pull the last assistant text out of a session messages array.
 * Messages follow the Claude API shape: { role, content: string | ContentBlock[] }
 */
function extractLastAssistantText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant") continue;

    if (typeof msg.content === "string") return msg.content;

    if (Array.isArray(msg.content)) {
      const text = msg.content
        .filter((b) => b?.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      if (text) return text;
    }
  }
  return "";
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const plugin = {
  id: "promptroot-gateway",

  register(api) {
    const cfg = api.pluginConfig ?? {};
    const JOB_TTL_MS = cfg.jobTtlMs ?? 24 * 60 * 60 * 1000; // 24 h
    const RUN_TIMEOUT_MS = cfg.runTimeoutMs ?? 5 * 60 * 1000; // 5 min
    const log = (msg) => api.logger.info?.(`[promptroot-gateway] ${msg}`);
    const logErr = (msg) => api.logger.error?.(`[promptroot-gateway] ${msg}`);

    api.registerHttpRoute({
      path: "/api/prompt",
      auth: "gateway",
      match: "prefix",

      handler: async (req, res) => {
        // Normalise URL: strip query string and split into segments
        const rawPath = (req.url ?? "").split("?")[0];
        const segments = rawPath.replace(/^\/+|\/+$/g, "").split("/");
        // Expected segments: ["api", "prompt"] or ["api", "prompt", "<jobId>"]

        // ── POST /api/prompt ─────────────────────────────────────────────────
        if (segments.length === 2 && req.method === "POST") {
          let body;
          try {
            const raw = await readBody(req);
            body = JSON.parse(raw);
          } catch {
            sendJson(res, 400, { error: "Invalid or oversized JSON body" });
            return true;
          }

          if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
            sendJson(res, 400, { error: '"text" field is required and must be a non-empty string' });
            return true;
          }

          const jobId = randomBytes(8).toString("hex");
          const sessionKey = `promptroot-${jobId}`;

          jobs.set(jobId, {
            status: "pending",
            createdAt: new Date().toISOString(),
            slug: typeof body.slug === "string" ? body.slug : null,
          });
          scheduleExpiry(jobId, JOB_TTL_MS);

          log(`job ${jobId} queued (slug=${body.slug ?? "none"})`);

          // Run agent in background — don't await
          (async () => {
            try {
              const { runId } = await api.runtime.subagent.run({
                sessionKey,
                message: body.text,
                deliver: false,
              });

              const waitResult = await api.runtime.subagent.waitForRun({
                runId,
                timeoutMs: RUN_TIMEOUT_MS,
              });

              if (waitResult.status === "ok") {
                const { messages } = await api.runtime.subagent.getSessionMessages({
                  sessionKey,
                  limit: 20,
                });

                const output = extractLastAssistantText(messages);
                const current = jobs.get(jobId);
                if (current) {
                  jobs.set(jobId, {
                    ...current,
                    status: "complete",
                    output,
                    completedAt: new Date().toISOString(),
                  });
                }
                log(`job ${jobId} complete (${output.length} chars)`);
              } else {
                const current = jobs.get(jobId);
                if (current) {
                  jobs.set(jobId, {
                    ...current,
                    status: "error",
                    error: waitResult.error ?? `Agent run ended with status: ${waitResult.status}`,
                  });
                }
                logErr(`job ${jobId} failed: ${waitResult.error ?? waitResult.status}`);
              }

              // Clean up session — don't leak session data beyond job TTL
              setTimeout(async () => {
                try {
                  await api.runtime.subagent.deleteSession({ sessionKey });
                } catch {
                  // Best-effort cleanup; session may have already been deleted
                }
              }, JOB_TTL_MS).unref();
            } catch (err) {
              const current = jobs.get(jobId);
              if (current) {
                jobs.set(jobId, {
                  ...current,
                  status: "error",
                  error: String(err),
                });
              }
              logErr(`job ${jobId} threw: ${String(err)}`);
            }
          })();

          sendJson(res, 202, {
            jobId,
            pollUrl: `/api/prompt/${jobId}`,
          });
          return true;
        }

        // ── GET /api/prompt/:jobId ────────────────────────────────────────────
        if (segments.length === 3 && req.method === "GET") {
          const jobId = segments[2];
          const job = jobs.get(jobId);

          if (!job) {
            sendJson(res, 404, { error: "Job not found or expired" });
            return true;
          }

          if (job.status === "pending") {
            sendJson(res, 200, { status: "pending" });
            return true;
          }

          if (job.status === "complete") {
            sendJson(res, 200, {
              status: "complete",
              output: job.output,
              completedAt: job.completedAt,
            });
            return true;
          }

          // error
          sendJson(res, 200, {
            status: "error",
            error: job.error,
          });
          return true;
        }

        // ── Everything else ───────────────────────────────────────────────────
        sendJson(res, 405, { error: "Method not allowed" });
        return true;
      },
    });

    log("registered POST /api/prompt and GET /api/prompt/:jobId");
  },
};

export default plugin;
