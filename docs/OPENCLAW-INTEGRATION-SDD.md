# SDD-0002: PromptRoot × OpenClaw Integration

**Version:** 3.0 — 2026-03-22 | **Status:** Mostly Complete
**Author:** Brace

---

## Status Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Gateway spike — `promptroot-gateway` plugin | ✅ Complete |
| 1 | Read access — PromptRoot skill (fetch/list scripts) | ✅ Complete |
| 2 | Write access — Brace → PromptRoot contributions | ✅ Complete |
| 3a | "Run in Brace" (Jesse only, Cloudflare Tunnel) | ❌ Superseded by Phase 7 |
| 3b | "Run in Brace" (multi-user, PromptRoot relay) | ✅ End-to-end working |
| 5 | Queue integration via service account | ❌ Superseded by Phase 6 |
| 6 | Agent API (`agentApi` + `manageAgentKeys` Cloud Functions) | ✅ Complete |
| 7 | Brace Web UI — Open WebUI on fly.io | ✅ Complete |

**Remaining work:**
- Phase 3b: relay connection status indicator (`GET /{uid}/status`)
- Logo: upload in Brace UI admin settings (cosmetic)

---

## Phase Dependency Graph

```
Phase 0 ──► Phase 3a (Run in Brace, Jesse only — Cloudflare Tunnel)
Phase 3a ──► Phase 3b (multi-user relay)
Phase 1 ──► Phase 2 (Brace → PromptRoot contributions)
Phase 6 ──► Phase 3b (relay auth uses agent token)
Phase 0 + Phase 3b ──► Phase 7 (Brace Web UI)
```

---

## Overview

PromptRoot is a prompt library + Jules workflow tool. OpenClaw (Brace) is a persistent AI assistant. This SDD connects them into a unified AI workflow.

**Goals:**
- Brace can fetch and execute PromptRoot prompts
- PromptRoot can trigger Brace sessions via "Run in Brace" button
- Brace can contribute prompts back to PromptRoot
- Brace Web UI (`brace-ui.fly.dev`) provides a Jules-style multi-session interface

---

## Phase 0 — Gateway Spike ✅

**What was built:** `promptroot-gateway` OpenClaw plugin (`~/.openclaw/extensions/promptroot-gateway/`) adds `POST /api/prompt` and `GET /api/prompt/:jobId` to the OpenClaw gateway using `subagent.run()`.

**Decision:** Cloudflare Tunnel (named recommended) to expose the local gateway for Cloud Functions. Gateway stays on loopback. p50/p95 latency: ~15–30s / 60–90s — 5-minute poll timeout is appropriate.

---

## Phase 1 — Read Access ✅

**What was built:**
- `workspace/skills/promptroot/SKILL.md` — skill definition
- `scripts/fetch-prompt.sh <owner/repo> <branch> <slug>` — fetch prompt by slug
- `scripts/list-prompts.sh <owner/repo> <branch>` — list all prompts
- Bats smoke tests: 12/12 passing
- Scripts accept `owner/repo` and `branch` as arguments — not hardcoded

---

## Phase 2 — Write Access ✅

**What was built:**
- Prompt extraction heuristic in `HEARTBEAT.md` (triggers: explicit request, repeat pattern ≥2×/7 days, standalone artifact produced without existing template)
- Contribution workflow in `SKILL.md` (create branch, write `.md`, open PR to `promptroot/promptroot`)
- Confirmation step: Brace proposes candidates, Jesse approves before PR
- `[brace-generated]` label created in `promptroot/promptroot` repo

---

## Phase 3a — "Run in Brace" (Jesse only, Cloudflare Tunnel)

**PromptRoot side:** ✅ Complete (PR #777)
- `openclaw-keys.js` — encrypt/store gateway token + URL
- `openclaw-api.js` — `sendToBrace()` / `pollJob()` wrappers
- `brace-modal.js` — relay vs custom-URL mode selector
- `brace-response-panel.js` — polling UI + markdown render
- "Run in Brace" button in prompt viewer action bar
- `/openclaw` settings page with hero, feature grid, 4-step relay setup, status card

**Still needed:** Jesse sets up Cloudflare tunnel and runs manual end-to-end test (blocked on Q6).

**Tunnel setup (quick):**
```bash
cloudflared tunnel --url http://localhost:{OPENCLAW_GATEWAY_PORT}
# Paste *.trycloudflare.com URL into PromptRoot settings — changes on restart
```

**Named tunnel (recommended — stable URL):**
```bash
cloudflared tunnel create promptroot-gateway
cloudflared tunnel route dns promptroot-gateway gateway.yourdomain.com
cloudflared tunnel run promptroot-gateway
```

---

## Phase 3b — "Run in Brace" (Multi-User, PromptRoot Relay) ✅

**Architecture:**
```
OpenClaw ──WebSocket──► promptroot-relay.fly.dev ◀──HTTPS── Firebase Cloud Function
```

**User setup:**
1. Generate `PROMPTROOT_AGENT_TOKEN` from `/agent-api`
2. `export PROMPTROOT_AGENT_TOKEN="pra_..."` in `~/.bashrc`
3. Ensure `promptroot-relay` plugin is enabled in `openclaw.json` (already done for Jesse)

**What was built:**
- `relay/index.js` — Node.js WebSocket server + HTTP job endpoints
- `relay/Dockerfile` + `relay/fly.toml` — deployed to `promptroot-relay.fly.dev` (1 shared-CPU 1GB, `iad`, always-on)
- `promptroot-relay` OpenClaw plugin (`~/.openclaw/extensions/promptroot-relay/index.js`) — connects to `wss://promptroot-relay.fly.dev/connect`; reconnects on disconnect (exp backoff); yields to newer connection on close code 4000
- Cloud Function `callOpenclawGateway` routes to relay when `useRelay: true`

**Relay auth:** Bearer token validated via `agentKeysByHash/{sha256(token)}` Firestore lookup (one read per connection, cached in memory).

**OpenAI proxy route:** Relay also proxies `POST /v1/chat/completions` and `GET /v1/models` — authenticated via agent token, forwards to OpenClaw's `/v1/chat/completions` endpoint. This is what Phase 7 (Brace UI) uses via the relay.

**Still needed:** Relay connection status indicator (`GET /{uid}/status`) on OpenClaw settings page.

---

## Phase 6 — Agent API ✅

**Cloud Functions deployed 2026-03-22:**
- `agentApi` — agent bearer token (`pra_...`) auth; serves data API
- `manageAgentKeys` — Firebase ID token auth; CRUD for agent keys

**Base URL:** `https://us-central1-promptroot-b02a2.cloudfunctions.net/agentApi`

**Token format:** `pra_` + 64 hex chars (32 random bytes). Generated client-side; only SHA-256 hash stored server-side. Multiple named tokens per user, each individually revocable from `/agent-api`.

**Rate limiting:** 60 req/min per token (in-memory counter per Cloud Function instance).

**Still needed:** Generate first token, add to `~/.bashrc` as `PROMPTROOT_AGENT_TOKEN`.

### API Contract

**Auth:** `Authorization: Bearer pra_...`

#### Prompts
```
GET  /prompts?branch=main&path=prompts/          → file list
GET  /prompts/{slug}?branch=main                 → { content, placeholders, conditionalFlags }
POST /prompts/render  { slug, branch, values }   → { rendered }
```

#### Queue
```
GET    /queue?status=pending&limit=20            → { items }
POST   /queue  { promptText, tags, scheduledAt } → 201 { id, ... }
PATCH  /queue/{itemId}  { status, result }       → 200
DELETE /queue/{itemId}                           → 204
```

#### Web Clips
```
GET /webclips?limit=20&since=<ISO>               → { clips }
GET /webclips/{filename}                         → markdown content
POST /webclips  { filename, content }            → commits to webclips/{username}/
```
> ⚠️ `POST /webclips` requires GitHub `contents:write` scope — see Q3.

#### Sessions
```
GET /sessions?limit=10&page=1                    → { sessions }
```

#### Agent Key Management (`manageAgentKeys` — Firebase ID token auth)
```
POST { action: "list" }                          → { tokens }
POST { action: "create", tokenHash, label }      → { ok: true }
POST { action: "revoke", tokenHash }             → { ok: true }
```

---

## Phase 7 — Brace Web UI ✅

**URL:** `https://brace-ui.fly.dev`

**Architecture:**
```
Open WebUI (brace-ui.fly.dev)
  └── OPENAI_API_BASE_URL = https://promptroot-relay.fly.dev/v1
        └── relay proxies POST /v1/chat/completions → OpenClaw gateway (:18789)
```

**"Run in Brace" button (current behavior):**
```javascript
window.open('https://brace-ui.fly.dev/?q=' + encodeURIComponent(filledPrompt), '_blank');
```
Variable substitution modal fires first if template has unfilled `{PLACEHOLDERS}`.

**fly.toml (final working config):**
```toml
app = 'brace-ui'
primary_region = 'iad'

[build]
  image = 'ghcr.io/open-webui/open-webui:main'

[deploy]
  strategy = 'immediate'   # Open WebUI takes ~2.5min; default waits 15s and fails

[env]
  WEBUI_NAME = 'Brace'
  ENABLE_SIGNUP = 'false'
  ENABLE_IMAGE_GENERATION = 'false'
  ENABLE_COMMUNITY_SHARING = 'false'
  ENABLE_MESSAGE_RATING = 'false'
  DEFAULT_USER_ROLE = 'admin'
  PORT = '8080'
  ENABLE_RAG_WEB_SEARCH = 'false'
  HF_HOME = '/app/backend/data/.cache/huggingface'   # persist embedding model on volume

[[mounts]]
  source = 'brace_data'
  destination = '/app/backend/data'

[http_service]
  force_https = true
  auto_stop_machines = 'off'   # must be off: stops mid-init otherwise
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = 'shared-cpu-1x'
  memory = '2048mb'   # 1024mb = OOM-killed (exit 137, no log)
```

**Deployment learnings:**
1. **2048MB minimum.** PyTorch + sentence-transformers + LangChain OOM-kill at 1024MB with no log (exit 137). Diagnose via `fly machine status <id>` → look for `oom_killed=true`.
2. **Do NOT set `RAG_EMBEDDING_ENGINE=openai`.** Causes startup call to `/v1/embeddings` — our gateway doesn't implement it; silent crash at ~135s.
3. **Cache HuggingFace model on volume.** Set `HF_HOME=/app/backend/data/.cache/huggingface`. First boot: ~70s download. Subsequent boots: instant.
4. **First-boot crash+restart is normal.** DB init race on fresh volume; second run always succeeds.
5. **`strategy = 'immediate'` required.** Default deploy waits 15s; app needs 2.5min.
6. **`auto_stop_machines = 'off'`.** Machine stops mid-init on first boot (no traffic yet). Re-enable after confirmed stable — expect 3-minute cold starts.
7. **Health check `grace_period` capped at 60s.** Omit `[[http_service.checks]]` entirely; fly uses TCP routing (port open = healthy), which works correctly.

**Streaming fix (applied to relay + plugin):**
- `relay/index.js`: write SSE chunks directly (`pending.res.write(chunk)`) — chunks from OpenClaw are already SSE-formatted; don't add `data:` prefix
- `promptroot-relay/index.js`: use `Buffer.from(chunk).toString('utf8')` not `chunk.toString()` — Node 22 native fetch returns `Uint8Array`; `.toString()` gives comma-separated bytes

**Gateway config key:** `gateway.http.endpoints.chatCompletions.enabled: true` (not `gateway.openai.chatCompletions`)

---

## Open Questions

| # | Question | Blocks |
|---|----------|--------|
| 5 | Should `promptroot-relay` plugin be upstreamed to OpenClaw repo? | Phase 3b maintenance |
| 6 | Does Jesse have a Cloudflare-managed domain for named tunnel? | Phase 3a stable URL |
| 7 | `RELAY_SHARED_SECRET` rotation plan | Phase 3b security |

*Resolved: Q1 (gateway endpoints built), Q2 (Cloudflare Tunnel), Q4 (Fly.io)*

---

## Firestore Collections

| Collection | Purpose | Access |
|------------|---------|--------|
| `openclawKeys/{uid}` | Encrypted gateway token + URL/relay mode | Firebase rules: owner only |
| `agentKeys/{uid}` | Agent token hashes + labels | Admin SDK only |
| `agentKeysByHash/{hash}` | Reverse lookup: hash → uid | Admin SDK only |

---

## Key Files

| File | Description |
|------|-------------|
| `relay/index.js` | PromptRoot relay service (WebSocket + HTTP) |
| `relay/fly.toml` | Fly.io config for relay |
| `~/.openclaw/extensions/promptroot-relay/index.js` | OpenClaw relay plugin |
| `~/.openclaw/extensions/promptroot-gateway/index.js` | OpenClaw gateway plugin (`/api/prompt`) |
| `~/.openclaw/workspace/deploy/brace-ui/fly.toml` | Brace Web UI Fly.io config |
| `src/modules/openclaw-keys.js` | Encrypt/store gateway token |
| `src/modules/openclaw-api.js` | `sendToBrace()` / `pollJob()` wrappers |
| `src/modules/brace-modal.js` | Token entry modal (relay vs custom URL) |
| `src/modules/brace-response-panel.js` | Inline response panel (Phase 3a/3b fallback) |
| `src/modules/agent-keys.js` | Agent API key management UI |
| `workspace/skills/promptroot/SKILL.md` | Brace PromptRoot skill |
| `workspace/skills/promptroot/scripts/fetch-prompt.sh` | Fetch prompt by slug |
| `workspace/skills/promptroot/scripts/list-prompts.sh` | List available prompts |
| `pages/openclaw/openclaw.html` | OpenClaw settings page |
| `pages/agent-api/agent-api.html` | Agent API key management page |
