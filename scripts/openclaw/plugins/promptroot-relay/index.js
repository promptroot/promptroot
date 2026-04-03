/**
 * promptroot-relay — OpenClaw plugin
 *
 * Opens a persistent WebSocket to relay.promptroot.io, authenticated with
 * PROMPTROOT_AGENT_TOKEN. When a prompt job arrives from PromptRoot, it is
 * executed via subagent.run() and the result is sent back over the socket.
 *
 * Setup (one-time):
 *   1. Generate a token at https://promptroot.io/agent-api
 *   2. export PROMPTROOT_AGENT_TOKEN="pra_..."  (add to ~/.bashrc)
 *   3. Enable this plugin in openclaw.json (already done)
 *   4. Restart the gateway — it will connect automatically
 *
 * SDD-0002 Phase 3b
 */

import { WebSocket } from "ws";
import os from "os";
import path from "path";
import fs from "fs";

// ─── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Pull the last assistant text out of a session messages array.
 * Messages follow Claude API shape: { role, content: string | ContentBlock[] }
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

const DEFAULT_RELAY_URL = "wss://promptroot-relay.fly.dev/connect";
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

const plugin = {
  id: "promptroot-relay",

  register(api) {
    // Only one instance should connect to the relay. Both the parent (openclaw)
    // and child (openclaw-gateway) processes load this plugin simultaneously.
    // Use O_EXCL (atomic exclusive create) so exactly one wins the race.
    const lockFile = path.join(os.tmpdir(), "promptroot-relay.lock");

    function tryAcquireLock() {
      // Check for existing lock with a live holder first
      try {
        const existing = fs.readFileSync(lockFile, "utf8").trim();
        const existingPid = parseInt(existing, 10);
        if (!isNaN(existingPid)) {
          try {
            process.kill(existingPid, 0); // throws if PID is dead
            return false; // live holder — yield
          } catch {
            // Dead holder — clean up and fall through to O_EXCL attempt
            try { fs.unlinkSync(lockFile); } catch {}
          }
        }
      } catch {
        // No lock file — fall through to O_EXCL attempt
      }
      // Atomically create the lock file (O_EXCL fails if file already exists)
      try {
        const fd = fs.openSync(lockFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
        fs.writeSync(fd, String(process.pid));
        fs.closeSync(fd);
        return true;
      } catch (err) {
        if (err.code === "EEXIST") return false; // lost the race
        throw err;
      }
    }

    if (!tryAcquireLock()) {
      api.logger.info?.("[promptroot-relay] skipping — another instance holds the relay lock");
      return;
    }
    api.logger.info?.(`[promptroot-relay] acquired relay lock (pid=${process.pid})`);

    const releaseLock = () => {
      try {
        const held = fs.readFileSync(lockFile, "utf8").trim();
        if (held === String(process.pid)) fs.unlinkSync(lockFile);
      } catch {}
    };
    process.on("exit", releaseLock);
    process.on("SIGTERM", releaseLock);

    const token = process.env.PROMPTROOT_AGENT_TOKEN;
    if (!token) {
      api.logger.warn?.(
        "[promptroot-relay] PROMPTROOT_AGENT_TOKEN is not set — plugin will not connect. " +
          "Generate a token at https://promptroot.io/agent-api and add it to your environment.",
      );
      return;
    }

    const cfg = api.pluginConfig ?? {};
    const RELAY_URL = cfg.relayUrl ?? DEFAULT_RELAY_URL;
    const RUN_TIMEOUT_MS = cfg.runTimeoutMs ?? 5 * 60 * 1000;

    const log = (msg) => api.logger.info?.(`[promptroot-relay] ${msg}`);
    const logErr = (msg) => api.logger.error?.(`[promptroot-relay] ${msg}`);

    let ws = null;
    let reconnectAttempt = 0;
    let stopped = false;
    let reconnectTimer = null;
    const sendQueue = []; // Responses buffered while WS is reconnecting

    // ── Job executor ───────────────────────────────────────────────────────────

    async function executeJob(jobId, text, slug) {
      const sessionKey = `promptroot-relay-${jobId}`;
      log(`job ${jobId} started (slug=${slug ?? "none"})`);

      try {
        const { runId } = await api.runtime.subagent.run({
          sessionKey,
          idempotencyKey: jobId,
          message: text,
          deliver: false,
        });

        const waitResult = await api.runtime.subagent.waitForRun({
          runId,
          timeoutMs: RUN_TIMEOUT_MS,
        });

        let output = "";
        let error;

        if (waitResult.status === "ok") {
          const { messages } = await api.runtime.subagent.getSessionMessages({
            sessionKey,
            limit: 20,
          });
          output = extractLastAssistantText(messages);
          log(`job ${jobId} complete (${output.length} chars)`);
        } else {
          error = waitResult.error ?? `run ended with status: ${waitResult.status}`;
          logErr(`job ${jobId} failed: ${error}`);
        }

        // Clean up session after a short grace period
        setTimeout(async () => {
          try {
            await api.runtime.subagent.deleteSession({ sessionKey });
          } catch {
            // Best-effort
          }
        }, 30_000).unref();

        return { output, error };
      } catch (err) {
        logErr(`job ${jobId} threw: ${String(err)}`);
        return { output: "", error: String(err) };
      }
    }

    // ── WebSocket lifecycle ────────────────────────────────────────────────────

    function sendSafe(payload) {
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(payload));
        } catch (err) {
          logErr(`send failed: ${String(err)}`);
          sendQueue.push(payload);
        }
      } else {
        // WS is reconnecting — buffer and flush on next open
        log(`queued response for ${payload.requestId ?? payload.jobId} (ws not open)`);
        sendQueue.push(payload);
      }
    }

    function connect() {
      if (stopped) return;

      log(`connecting to ${RELAY_URL} (attempt ${reconnectAttempt + 1})`);

      ws = new WebSocket(RELAY_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      ws.on("open", () => {
        reconnectAttempt = 0;
        log("connected to relay");
        // Flush any responses that were buffered while reconnecting
        while (sendQueue.length > 0) {
          const queued = sendQueue.shift();
          try {
            ws.send(JSON.stringify(queued));
            log(`flushed queued response for ${queued.requestId ?? queued.jobId}`);
          } catch (err) {
            logErr(`flush failed: ${String(err)}`);
          }
        }
      });

      ws.on("message", async (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (msg.type === "job") {
          const { jobId, text, slug } = msg;
          if (!jobId || !text) {
            logErr(`malformed job message: ${JSON.stringify(msg)}`);
            return;
          }

          const { output, error } = await executeJob(jobId, text, slug);

          sendSafe({
            type: "result",
            jobId,
            result: output,
            completedAt: new Date().toISOString(),
            ...(error ? { error } : {}),
          });
          return;
        }

        if (msg.type === "openai") {
          const { requestId, body } = msg;
          if (!requestId || !body) {
            logErr(`malformed openai message: missing requestId or body`);
            return;
          }

          log(`openai request ${requestId} via subagent`);

          // Convert the messages array to a single prompt string.
          // Include system prompt and full conversation history as context.
          const getText = (content) => {
            if (typeof content === "string") return content;
            if (Array.isArray(content))
              return content
                .filter((b) => b?.type === "text")
                .map((b) => b.text ?? "")
                .join("");
            return "";
          };

          const messages = body.messages ?? [];
          const systemMsg = messages.find((m) => m.role === "system");
          const chatMessages = messages.filter((m) => m.role !== "system");

          let prompt = "";
          if (systemMsg) {
            prompt += `System: ${getText(systemMsg.content)}\n\n`;
          }
          if (chatMessages.length > 1) {
            prompt += chatMessages
              .slice(0, -1)
              .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${getText(m.content)}`)
              .join("\n\n");
            prompt += "\n\n";
          }
          const lastMsg = chatMessages[chatMessages.length - 1];
          prompt += lastMsg ? getText(lastMsg.content) : "";

          const sessionKey = `promptroot-openai-${requestId}`;

          try {
            const { runId } = await api.runtime.subagent.run({
              sessionKey,
              idempotencyKey: requestId,
              message: prompt,
              deliver: false,
            });

            const waitResult = await api.runtime.subagent.waitForRun({
              runId,
              timeoutMs: RUN_TIMEOUT_MS,
            });

            let output = "";
            let error;

            if (waitResult.status === "ok") {
              const { messages: sessionMessages } = await api.runtime.subagent.getSessionMessages({
                sessionKey,
                limit: 20,
              });
              output = extractLastAssistantText(sessionMessages);
              log(`openai request ${requestId} complete (${output.length} chars)`);
            } else {
              error = waitResult.error ?? `run ended with status: ${waitResult.status}`;
              logErr(`openai request ${requestId} failed: ${error}`);
            }

            setTimeout(async () => {
              try { await api.runtime.subagent.deleteSession({ sessionKey }); } catch {}
            }, 30_000).unref();

            const responseBody = error
              ? { error: { message: error, type: "relay_error" } }
              : {
                  id: `chatcmpl_${requestId}`,
                  object: "chat.completion",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model || "brace",
                  choices: [
                    {
                      index: 0,
                      message: { role: "assistant", content: output },
                      finish_reason: "stop",
                    },
                  ],
                };

            sendSafe({ type: "openai_response", requestId, body: responseBody });
          } catch (err) {
            logErr(`openai request ${requestId} threw: ${String(err)}`);
            sendSafe({
              type: "openai_response",
              requestId,
              body: { error: { message: String(err), type: "relay_error" } },
            });
          }
          return;
        }

        // Unknown message types (ping, ack, etc.) are silently ignored
      });

      ws.on("close", (code, reason) => {
        if (stopped) return;
        const reasonStr = reason?.toString() || "no reason";
        // 4000 = replaced by a newer instance of this plugin — do not reconnect
        if (code === 4000) {
          log(`disconnected (${code} ${reasonStr}) — yielding to newer instance`);
          return;
        }
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
        reconnectAttempt++;
        log(`disconnected (${code} ${reasonStr}) — reconnecting in ${delay}ms`);
        reconnectTimer = setTimeout(connect, delay);
        reconnectTimer.unref();
      });

      ws.on("error", (err) => {
        // 'close' event always follows, so just log here
        logErr(`socket error: ${err.message ?? String(err)}`);
      });
    }

    connect();

    // ── Shutdown ───────────────────────────────────────────────────────────────

    api.on("gateway_stop", () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close(1000, "gateway stopping");
      log("disconnected (gateway stop)");
    });

    log(`plugin loaded — connecting to ${RELAY_URL}`);
  },
};

export default plugin;
