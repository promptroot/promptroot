# SDD-0002: PromptRoot × OpenClaw Integration

**Version:** 2.3
**Date:** 2026-03-22
**Author:** Brace
**Status:** In Progress

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-17 | Initial brainstorm — 7 integration vectors, 5 phases |
| 1.1 | 2026-03-18 | Design spike: Phase 3 gateway API + key management; acceptance criteria per phase; error handling for Vector 1; fix branch references |
| 1.2 | 2026-03-18 | Add Vector 8: PromptRoot Agent API — full REST API so OpenClaw can interact with the app without browser automation; Phase 6 spec |
| 1.3 | 2026-03-18 | Add UI changes, unit test plan, and E2E test plan |
| 1.4 | 2026-03-18 | Address Brace review: add Phase 0 gateway spike; resolve Phase 5/6 queue overlap; fix polling terminology; add error handling for Phases 2–6; add phase dependency graph; add job persistence model; define Phase 2 trigger criteria; evaluate heartbeat latency; verify GitHub write scope; add shell script tests; add missing CSS/nav items; make owner/repo configurable; document PROMPTROOT_AGENT_TOKEN storage |
| 1.5 | 2026-03-18 | Multi-user architecture: split Phase 3 into 3a (Cloudflare Tunnel, Jesse onl``y) and 3b (PromptRoot relay service, multi-user); relay architecture design; OpenClaw plugin spec |
| 1.6 | 2026-03-18 | Address Brace review: design token→uid reverse lookup index; warn on ephemeral tunnel URLs; add relay inbound auth (shared secret); clarify relay is in-memory (not stateless); specify concurrent job behavior; design response buffer; fix Firestore rate limit approach; fix POST /queue path; update brace-modal UI for relay mode selector; add Phase 6 prerequisite to Phase 3b user instructions |
| 1.7 | 2026-03-18 | Phase 6 implementation complete: multiple named tokens per user (not single token); `pra_` token prefix; separate `manageAgentKeys` HTTP function (Firebase ID token auth) vs `agentApi` (bearer token auth); actual Cloud Function URLs; mark Phase 6 tasks done; update UI changes to match actual implementation; top-nav placement (not user dropdown) |
| 1.8 | 2026-03-19 | Phase 3a/3b PromptRoot-side implementation complete (PR #777)
| 1.9 | 2026-03-20 | Rename Bliz → Brace throughout; Phase 0 complete: gateway audited, `promptroot-gateway` OpenClaw plugin implemented (`POST /api/prompt` + `GET /api/prompt/:jobId` via `subagent.run`); Phase 0 tasks marked done; Phase 3a unblocked pending tunnel setup (Q6): `openclaw-keys.js`, `openclaw-api.js`, `brace-modal.js`, `brace-response-panel.js`, `callOpenclawGateway` + `pollOpenclawJob` Cloud Functions, `/openclaw` settings page, "Run in Brace" button in prompt action bar; mark Phase 3a PromptRoot tasks done; update Phase 3b tasks (PromptRoot side done, relay service + OpenClaw plugin still pending); update Notes |
| 2.0 | 2026-03-20 | Phase 3b relay service built: `relay/index.js` (Node.js WebSocket + HTTP), `relay/Dockerfile`, `relay/fly.toml` (Fly.io, 1 shared-CPU 256MB instance, `iad`); answers Q4 (Fly.io chosen over Cloud Run — no sticky session complexity); relay validates `pra_...` tokens via `agentKeysByHash` Firestore lookup; in-memory job store with 10min TTL; `RELAY_SHARED_SECRET` + `FIREBASE_SERVICE_ACCOUNT` env vars required at deploy; mark Phase 3b relay tasks done pending deploy + OpenClaw plugin |
| 2.1 | 2026-03-20 | Phase 3b end-to-end deployed and verified: relay live at `promptroot-relay.fly.dev` (scaled to 1 machine, `auto_stop_machines=off`); `promptroot-relay` OpenClaw plugin deployed at `~/.openclaw/extensions/promptroot-relay/index.js`; fixes: add `type:'job'` to relay dispatch, trim `RELAY_SHARED_SECRET` trailing newline, code 4000 → no reconnect, add `idempotencyKey`, store env in `~/.openclaw/.env`; end-to-end "Run in Brace" flow confirmed working |
| 2.2 | 2026-03-22 | `/openclaw` page redesigned: hero panel, 4-feature grid, 4-step relay setup guide (with `code-block` snippets), advanced custom-URL section, troubleshooting, live connection status card styled like webcapture extension detection; Agent API section moved to profile page; `input-field` → `form-control` for dark-mode; nav Agent API link removed; onboarding copy task marked done |
| 2.3 | 2026-03-22 | Add Phase 7: Brace Web UI (Open WebUI on fly.io backed by `/v1/chat/completions`); "Run in Brace" button opens new tab instead of inline response panel; `deploy/brace-ui/` config committed (Brace repo PR #3); `gateway.openai.chatCompletions: true` enabled in `openclaw.json` |
| 2.4 | 2026-03-22 | Phase 7 deployed and live: `brace-ui.fly.dev` serving 200 OK; document fly.io deployment learnings (2048MB required, `HF_HOME` on volume, `RAG_EMBEDDING_ENGINE=openai` must NOT be set, `auto_stop_machines='off'`, `strategy='immediate'`); mark deploy tasks done |
| 2.5 | 2026-03-22 | Phase 7 complete: "Run in Brace" opens new tab at `brace-ui.fly.dev/?q=<prompt>` and works end-to-end; relay SSE streaming fixed (Uint8Array → Buffer.from().toString('utf8'), drop double data: prefix); gateway config fixed (`gateway.http.endpoints.chatCompletions.enabled` not `gateway.openai`); all Phase 7 core tasks done |

---

## Phase Dependency Graph

```
Phase 0 (Gateway Spike) ──► Phase 3a (Run in Brace, Jesse only — Cloudflare Tunnel)
Phase 3a ────────────────────────────────────────────────────► Phase 3b (multi-user relay)
Phase 1 (Read: PromptRoot skill) ──► Phase 2 (Write: Brace → PromptRoot)
Phase 1 ─────────────────────────────────────────────────────► Phase 4 (Web Capture)
Phase 6 (Agent API) ──► Phase 4 (replaces gh api polling)
Phase 6 (Agent API) ──► Phase 5* (supersedes service-account approach)
Phase 6 (Agent API) ──► Phase 3b (relay token tied to Agent API uid)

*Phase 5 (queue via service account) is an interim path only — Phase 6 supersedes it.
 Do not build Phase 5 if Phase 6 is less than 4 weeks away.
```

Phases 1 and 6 are independently startable. Phase 3a requires Phase 0. Phase 3b requires Phase 3a and Phase 6.

---

## Overview

PromptRoot is a prompt library + Jules workflow tool. OpenClaw is a persistent AI assistant with skills, memory, and multi-channel messaging. These two tools have significant overlap and complementary strengths — this SDD designs how to connect them into a unified AI workflow.

## Goals

- Let OpenClaw agents consume and execute PromptRoot prompts
- Let PromptRoot trigger and manage OpenClaw sessions
- Create a two-way sync: prompts authored in PromptRoot, executed by Brace
- Surface OpenClaw session outputs back into PromptRoot

## Non-Goals

- Replacing Jules integration (Jules and OpenClaw serve different use cases)
- Full platform merger
- Real-time collaborative editing of prompts

---

## Integration Vectors

### 1. PromptRoot as Brace's Prompt Library

OpenClaw agents currently store prompts ad-hoc in workspace files. PromptRoot provides a structured, versioned, browsable library. Brace could:

- Pull prompts from PromptRoot by slug (`#p=slug`) on demand
- Have a `promptroot` skill that fetches and executes prompts
- Use PromptRoot's variable substitution (`{PLACEHOLDER}`) natively
- Auto-suggest relevant prompts from the library when starting tasks

**Implementation:**
- New `promptroot` skill in `workspace/skills/`
- `gh api` or raw GitHub fetch to read `.md` files from the repo
- Parse `{VARIABLE}` placeholders and prompt Jesse interactively
- Execution log written back to `memory/YYYY-MM-DD.md`

**Error handling:**
- GitHub rate limit: retry with exponential backoff (max 3 attempts), then surface error to Jesse via Telegram
- Branch/slug not found: fall back to `main` branch and notify Jesse
- Network failure: surface error, do not silently skip

---

### 2. "Run in Brace" Button in PromptRoot

Similar to "⚡ Try in Jules", add a "🦞 Run in Brace" button that sends the substituted prompt to Brace. Two modes depending on phase:

- **Phase 3a/3b (inline panel):** sends prompt via Cloud Function → gateway/relay, polls for response, renders inline below the prompt viewer
- **Phase 7 (new tab — current recommended path for Jesse):** opens `https://brace-ui.fly.dev/?q=<encoded prompt>` in a new tab, where Open WebUI picks it up and starts the chat. No polling, no inline panel — the full Jules-style multi-session experience.

If the template has unfilled `{PLACEHOLDERS}`, the variable substitution modal fires first (same as Jules). The new tab opens with the fully-rendered prompt.

**Implementation:** Phase 3 design spike for the relay/polling path; Phase 7 for the new-tab path.

---

### 3. SDD Workflow Integration

PromptRoot has a versioned SDD prompt template (`prompts/tutorial/templates/versioned-modular-sdd-plan.md`). Brace generates SDDs locally. Bridge them:

- Brace pulls the versioned SDD template from PromptRoot
- Fills in variables interactively with Jesse
- Saves the completed SDD to `workspace/SDD/`
- Optionally commits a new prompt back to PromptRoot's `prompts/` folder

**Implementation:**
- Update Brace's `sdd` skill to fetch the template from PromptRoot (`main` branch)
- Add PromptRoot as the canonical SDD template source
- PR new SDDs back to `promptroot/promptroot` as sharable prompts

---

### 4. PromptRoot as OpenClaw Skill

Package PromptRoot access as an OpenClaw skill:

```
workspace/skills/promptroot/
├── SKILL.md
└── scripts/
    ├── fetch-prompt.sh     # fetch by slug
    └── list-prompts.sh     # list available prompts
```

Brace could then respond to:
- "Run the code-review prompt on this file"
- "What prompts do we have for onboarding?"
- "Create a new prompt for X and push it"

---

### 5. OpenClaw Session Logging → PromptRoot

Every significant Brace session generates insights and patterns. Feed those back:

- After completing a task, Brace identifies reusable prompt patterns
- Auto-drafts a new `.md` file and opens a PR to `promptroot/promptroot`
- Jesse reviews and merges — crowdsourcing effective prompts

**Implementation:**
- Post-session hook in HEARTBEAT.md: "Review today's sessions for reusable prompts"
- `gh pr create` to `promptroot/promptroot` with new prompt file
- Tag PRs with `[brace-generated]` label

---

### 6. Web Capture → Brace Context

PromptRoot's browser extension captures web pages as Markdown to `webclips/`. Brace could:

- Monitor `webclips/jessewashburn/` for new clips
- Summarize them using the `summarize` skill
- Flag relevant clips during heartbeats
- Use clips as context when answering questions

**Implementation:**
- Heartbeat check: `gh api` poll for new files in `webclips/jessewashburn/`
- Auto-summarize new clips and send a Telegram notification
- Store clip summaries in `memory/YYYY-MM-DD.md`

---

### 7. PromptRoot Queue → Brace Task Queue

PromptRoot has a Jules task queue. Add OpenClaw as a second execution target:

- Queue items can be tagged `[brace]` or `[jules]`
- Brace polls the queue (via heartbeat or webhook)
- Executes tagged tasks and writes results back to Firestore

**Implementation:**
- Firestore read access for Brace via **service account** (see Phase 5 notes)
- New `promptroot-queue` skill
- Queue items processed as sub-agent tasks via `sessions_spawn`

---

## Phase 3 Design Spike: "Run in Brace" Button (3a + 3b)

### Gateway API Contract

The OpenClaw gateway exposes a REST endpoint that accepts prompt text and returns a job ID. PromptRoot polls for the result. The Cloud Function reaches the gateway via one of two paths depending on user config:

- **Phase 3a (Cloudflare Tunnel):** `gatewayUrl` stored in `openclawKeys/{uid}` — Cloud Function calls that URL directly
- **Phase 3b (Relay):** `useRelay: true` in `openclawKeys/{uid}` — Cloud Function calls `relay.promptroot.io/{uid}/prompt`, which forwards to the user's connected OpenClaw instance

```
POST /api/prompt
Authorization: Bearer {OPENCLAW_GATEWAY_TOKEN}
Content-Type: application/json

{
  "text": "<substituted prompt text>",
  "source": "promptroot",
  "slug": "versioned-modular-sdd-plan"   // optional, for logging
}

→ 202 Accepted
{
  "jobId": "abc123",
  "pollUrl": "/api/prompt/abc123"
}
```

```
GET /api/prompt/{jobId}
Authorization: Bearer {OPENCLAW_GATEWAY_TOKEN}

→ 200 OK (pending)
{ "status": "pending" }

→ 200 OK (complete)
{
  "status": "complete",
  "output": "<Brace response text>",
  "completedAt": "2026-03-18T12:00:00Z"
}
```

PromptRoot polls every 3 seconds, times out at 5 minutes (UI only — job persists on the gateway for 24h), and shows a live status indicator in the UI. There is no streaming — the response is delivered in full on the first `complete` poll response.

### Key Management

Mirrors the Jules key pattern exactly:

**Client-side (browser):**
- User pastes their `OPENCLAW_GATEWAY_TOKEN` into a modal (same UX as Jules modal)
- Token is encrypted with AES-GCM using PBKDF2-derived key (uid as key material, random salt + IV)
- Stored in Firestore at `openclawKeys/{uid}` with fields: `key`, `iv`, `salt`, `storedAt`
- Firestore rule: read/write only if `request.auth.uid == userId`

**Server-side (Cloud Function):**
- New callable function `callOpenclawGateway`
- Reads `openclawKeys/{uid}`, decrypts the token server-side
- Proxies `POST /api/prompt` to the gateway and returns the `jobId`
- A second callable `pollOpenclawJob` proxies the `GET /api/prompt/{jobId}` poll

Decryption never happens in the browser — same security model as Jules.

### New Firestore Collection

```
openclawKeys/{uid}
  key: string          // AES-GCM ciphertext, base64 — encrypted gateway token
  iv: string           // base64
  salt: string         // base64
  storedAt: timestamp
  gatewayUrl: string   // Phase 3a: user's Cloudflare Tunnel URL (e.g. https://xxx.trycloudflare.com)
  useRelay: boolean    // Phase 3b: true = route via relay.promptroot.io instead of gatewayUrl
```

Firestore rule (add to `firestore.rules`):
```
match /openclawKeys/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### New PromptRoot Modules

| File | Purpose |
|------|---------|
| `src/modules/openclaw-keys.js` | Encrypt/store/delete gateway token — mirrors `jules-keys.js` |
| `src/modules/openclaw-api.js` | `sendToBrace(text)`, `pollJob(jobId)` — callable function wrappers |
| `src/modules/brace-modal.js` | Token entry modal — mirrors `jules-modal.js` |
| `src/modules/brace-response-panel.js` | In-prompt-viewer panel showing job status + streamed output |

### "Run in Brace" Button Placement

Added to the prompt viewer action bar alongside the Jules button. Disabled + tooltip "Set up OpenClaw token in Settings" if no token stored. On click:

1. Check token exists (call `checkOpenclawKey`)
2. If not: open `brace-modal.js` to collect token, then proceed
3. `getCurrentText()` from variable modal (same as copen)
4. Check `sessionStorage` for an existing in-progress `jobId` for this prompt — if found and <24h old, resume polling instead of re-submitting
5. Call `sendToBrace(text)` → get `jobId`; store in `sessionStorage`
6. Open `brace-response-panel.js` below prompt viewer
7. Poll `pollJob(jobId)` every 3s, update panel with status
8. On complete: render Brace's response as markdown (DOMPurify sanitized)
9. On 5-minute UI timeout: show timeout state — job remains valid on gateway for 24h

### Security Notes

- Gateway must be accessible from Firebase Functions (Tailscale or public endpoint)
- If using Tailscale: the Cloud Function needs to be in the same tailnet or use a Tailscale egress node
- Token is never sent from the browser directly — only through the Cloud Function proxy
- Rate-limit the Cloud Function to prevent token abuse (1 req/s per uid)

---

## Phases

### Phase 0 — Gateway Spike (Blocker for Phase 3)

**Goal:** Document what the OpenClaw gateway actually exposes today and what needs to be built before any PromptRoot-side Phase 3 work begins. Phase 3 has no foundation without this.

**Acceptance criteria:**
- Written answer to: does the OpenClaw gateway expose `POST /api/prompt` and `GET /api/prompt/{jobId}` today?
- If not: implementation plan for adding them (scope, estimated effort)
- Written decision: public HTTPS endpoint or Tailscale egress for the gateway? Document the networking consequences for Cloud Function config.
- Written answer: what is the expected p50/p95 latency for a Brace response? Does 5-minute timeout + 3-second polling make sense?
- Gateway reachability test: can a Firebase Cloud Function reach the chosen gateway URL?

**Tasks:**
- [x] Audit existing OpenClaw gateway code for existing HTTP endpoints
- [x] Decide and document: public HTTPS via Cloudflare Tunnel (loopback gateway + cloudflared; Cloud Function reaches tunnel URL)
- [x] Gateway endpoints didn't exist — implemented `promptroot-gateway` OpenClaw plugin (`~/.openclaw/extensions/promptroot-gateway/`); registers `POST /api/prompt` and `GET /api/prompt/:jobId` using `subagent.run()` + `subagent.waitForRun()`
- [ ] Verify Firebase Cloud Function can reach the gateway via tunnel URL (manual curl test — Jesse to run after tunnel is set up)
- [x] Document decisions in workspace SDD-0002 v1.1 (2026-03-20)

**Networking decision:** Cloudflare Tunnel (quick or named). Gateway stays on loopback. Cloud Function calls the tunnel URL. No firewall changes required. Named tunnel recommended for stable URL — see Phase 3a setup instructions.

**p50/p95 latency:** ~15–30s / 60–90s. 5-minute timeout + 3-second polling is appropriate.

**Open question Q6 still open:** Jesse needs to decide: accept URL churn of quick tunnel, or use a named tunnel with a Cloudflare-managed domain.

---

### Phase 1 — Read Access (PromptRoot Skill)

**Goal:** Brace can fetch and execute any prompt from PromptRoot
**Acceptance criteria:**
- `fetch-prompt.sh promptroot/promptroot main versioned-modular-sdd-plan` returns the raw markdown
- `list-prompts.sh promptroot/promptroot main` lists all `.md` files under `prompts/`
- Scripts accept `owner/repo` and `branch` as arguments — not hardcoded
- Rate limit errors surface a Telegram notification, not a silent failure
- Variables in the fetched prompt are detected and Jesse is prompted for values
- Shell script smoke tests pass (see Unit Test Plan)

**Tasks:**
- [x] Create `workspace/skills/promptroot/SKILL.md`
- [x] Write `scripts/fetch-prompt.sh <owner/repo> <branch> <slug>` — parameterized, not hardcoded to `promptroot/promptroot`
- [x] Write `scripts/list-prompts.sh <owner/repo> <branch>` — parameterized
- [x] Update SDD skill to pull template from PromptRoot (`main` branch, `promptroot/promptroot`)
- [x] Write Bats smoke tests for both scripts — 12/12 passing
- [x] Test: `fetch-prompt.sh promptroot/promptroot main tutorial/templates/versioned-modular-sdd-plan` returns raw markdown ✓

---

### Phase 2 — Write Access (Brace → PromptRoot)

**Goal:** Brace can contribute prompts and SDDs back to PromptRoot
**Acceptance criteria:**
- Brace can create a PR to `promptroot/promptroot` with a new `.md` prompt file
- PR is tagged `[brace-generated]`
- Jesse receives a Telegram notification linking to the PR
- A session is only flagged for prompt extraction if it meets ≥1 trigger criterion (see below)

**Trigger criteria — what makes a session pattern reusable:**
A session qualifies for prompt extraction if it meets at least one of:
1. Jesse explicitly says "save this as a prompt" or "add this to PromptRoot"
2. Brace used the same ad-hoc instruction pattern ≥2 times in the last 7 days (detected by comparing session memory entries)
3. The session produced a standalone artifact (SDD, test plan, PR description) that didn't use an existing PromptRoot template

Brace does not auto-PR without Jesse's confirmation — it surfaces candidates and asks "Should I add this to PromptRoot?"

**Tasks:**
- [x] Define prompt extraction heuristic in HEARTBEAT.md (check session memory for repeat patterns)
- [x] Draft prompt contribution workflow (create branch, write `.md`, open PR) — in SKILL.md
- [x] Add confirmation step: Brace proposes candidate prompts, Jesse approves before PR — in SKILL.md and HEARTBEAT.md
- [x] Add `[brace-generated]` label to `promptroot/promptroot` repo

---

### Phase 3a — "Run in Brace" Button (Jesse only, Cloudflare Tunnel)

**Depends on:** Phase 0 (gateway spike must be complete and gateway endpoints must exist)

**Goal:** Jesse can invoke Brace from PromptRoot using a Cloudflare Tunnel to expose the local OpenClaw gateway. Single-user shortcut — ship fast, avoid relay infrastructure.

**Gateway setup (Jesse):**

> ⚠️ **`*.trycloudflare.com` URLs are ephemeral** — they change every time `cloudflared` restarts. Using a quick tunnel means updating `gatewayUrl` in PromptRoot settings after every restart. For a stable URL, use a **named tunnel** with a custom subdomain on a Cloudflare-managed domain instead:
> ```bash
> cloudflared tunnel create promptroot-gateway
> cloudflared tunnel route dns promptroot-gateway gateway.yourdomain.com
> cloudflared tunnel run promptroot-gateway
> ```
> This gives a stable `https://gateway.yourdomain.com` that persists across restarts. Requires a Cloudflare account and a domain pointed to Cloudflare. The quick tunnel approach below works but requires manual URL updates on restart.

**Quick tunnel (no Cloudflare account needed, URL changes on restart):**
```bash
cloudflared tunnel --url http://localhost:{OPENCLAW_GATEWAY_PORT}
# Paste the generated *.trycloudflare.com URL into PromptRoot OpenClaw settings
# Remember: update this URL in settings every time the tunnel restarts
```

**Named tunnel (recommended, stable URL):**
```bash
cloudflared tunnel create promptroot-gateway
cloudflared tunnel route dns promptroot-gateway gateway.yourdomain.com
cloudflared tunnel run promptroot-gateway
# Paste https://gateway.yourdomain.com into PromptRoot settings once — never needs updating
```

The tunnel URL is stored as the `gatewayUrl` field in `openclawKeys/{uid}` alongside the encrypted token.

**Acceptance criteria:**
- Jesse can store his gateway URL + token via a settings modal
- Clicking "Run in Brace" sends the substituted prompt text to the Cloudflare Tunnel URL via Cloud Function proxy
- A response panel polls every 3 seconds and displays the result when complete
- Brace's response renders as sanitized markdown in the panel
- All error states handled with visible UI feedback — see error handling below
- Token never transmitted from the browser directly
- Job results retrievable for 24 hours (see Job Persistence)

**Error handling:**
- Gateway unreachable (tunnel down or Cloudflare URL expired): toast "Brace is unreachable. Is your tunnel running?" Retry button in response panel.
- Cloud Function timeout (>60s): toast "Request timed out. Brace may still be processing." Panel shows timeout state with jobId.
- Firestore unavailable (can't read `openclawKeys`): toast "Could not load credentials. Check your connection."
- Gateway returns 401 (bad token): prompt user to re-enter token.
- UI timeout (5-minute poll limit): panel shows "Brace took too long. The job may still complete — check back later."
- Rate limit hit on PromptRoot Cloud Function (1 req/s per uid): silently back off 2 seconds, retry; show error only after 3 consecutive failures.

**Job persistence model:**
- Gateway jobs persist for 24 hours after creation
- `jobId` stored in `sessionStorage` keyed by prompt slug + timestamp
- If user closes and reopens the panel within 24h, the existing job is polled (not re-submitted)
- After 24h, `GET /api/prompt/{jobId}` returns 404 — panel shows "Result expired"

**Tasks:**
- [ ] **Prerequisite:** Phase 0 complete — gateway endpoints documented and reachable
- [x] Update `openclawKeys/{uid}` schema to include `gatewayUrl` and `useRelay` fields
- [x] Implement `openclaw-keys.js` (encrypt/store token + store gatewayUrl/useRelay)
- [x] Implement `callOpenclawGateway` and `pollOpenclawJob` Cloud Functions (routes to relay or direct URL based on `useRelay`)
- [x] Implement `openclaw-api.js` (polling wrappers via Firebase ID token fetch)
- [x] Implement `brace-modal.js` (relay vs custom-URL mode selector, token entry)
- [x] Implement `brace-response-panel.js` (polling UI + markdown render, all error states, jobId resume from sessionStorage)
- [x] Add "Run in Brace" button to prompt viewer action bar
- [x] Add `/openclaw` settings page (`pages/openclaw/`, `src/pages/openclaw-page.js`)

---

### Phase 3b — "Run in Brace" Button (Multi-User, PromptRoot Relay)

**Depends on:** Phase 3a (button + Cloud Function infrastructure already exists), Phase 6 (Agent API — relay auth uses `PROMPTROOT_AGENT_TOKEN`)

> ⚠️ **Phase 6 must be complete before Phase 3b is usable.** The relay authenticates OpenClaw connections using `PROMPTROOT_AGENT_TOKEN`, which is generated by Phase 6. Users cannot connect to the relay until they have an agent token. Phase 3b user-facing documentation must not be published until Phase 6 ships.

**Goal:** Any PromptRoot user can connect their own OpenClaw instance without running a tunnel, configuring a domain, or touching firewall rules. Setup is 3 steps.

**User setup (requires Phase 6 to be complete):**
1. Generate a `PROMPTROOT_AGENT_TOKEN` from `/agent-api` (Phase 6 — **already shipped**)
2. Add `export PROMPTROOT_AGENT_TOKEN="pra_..."` to `~/.bashrc` and OpenClaw secrets config
3. Add one line to `openclaw.json`: `"plugins": { "promptroot-relay": { "enabled": true } }`

OpenClaw auto-connects to `wss://relay.promptroot.io` using the agent token. No domain. No cloudflared. No firewall config.

**Architecture:**

```
User's OpenClaw ──WebSocket──▶ relay.promptroot.io ◀──HTTPS── Firebase Cloud Function
                               (persistent, keyed by uid)
```

- The relay is a lightweight Node.js service (Cloud Run or small VPS) that maintains persistent WebSocket connections from OpenClaw instances
- Each connection is authenticated by `PROMPTROOT_AGENT_TOKEN` (Phase 6) — the relay maps `uid → WebSocket connection`
- Token→uid reverse lookup: on connect, the relay hashes the bearer token (SHA-256) and looks it up in a Firestore collection `agentKeysByHash/{tokenHash}` which maps `tokenHash → uid`. This collection is written by the Phase 6 `generateAgentKey` Cloud Function alongside `agentKeys/{uid}` and deleted by `revokeAgentKey`. The relay makes one Firestore read per new connection, then caches `tokenHash → uid` in memory for the connection lifetime. This avoids scanning all `agentKeys` documents.
- Firebase Cloud Function calls `POST https://relay.promptroot.io/{uid}/prompt` — relay forwards to the connected OpenClaw instance
- No per-user URL configuration — the relay URL is fixed and shared

**Relay service design:**

```
relay.promptroot.io
  POST /{uid}/prompt          ← called by Firebase Cloud Function (requires RELAY_SHARED_SECRET)
  WS   /connect               ← long-lived connection from OpenClaw (requires PROMPTROOT_AGENT_TOKEN)
```

**Inbound HTTP auth (issue #4):** `POST /{uid}/prompt` is called by the Firebase Cloud Function and must not be open to the public. The relay verifies a `X-Relay-Secret: {RELAY_SHARED_SECRET}` header on every inbound HTTP request. `RELAY_SHARED_SECRET` is a shared secret set as an environment variable on both the Cloud Function and the relay service at deploy time. Any request without the correct header returns 401. This is simpler and more reliable than IP allowlisting (Firebase Functions IPs are not stable).

**In-memory state (not stateless):** The relay holds in-memory state — it is not stateless. It maintains:
- `connections: Map<uid, WebSocket>` — active OpenClaw connections
- `jobBuffer: Map<jobId, { response, completedAt }>` — completed job responses, kept for 5 minutes (enough for PromptRoot to poll; after that, responses are dropped and the poller gets 404)
- `jobQueue: Map<uid, Job[]>` — per-uid FIFO queue of pending jobs (max depth 3; see concurrent job handling)

A relay restart clears all in-memory state. Any in-flight jobs are dropped. The Cloud Function receives a 503 and surfaces a toast to the user.

**Concurrent jobs per uid:** If two PromptRoot jobs arrive for the same uid simultaneously:
- The relay maintains a per-uid FIFO job queue (max depth 3)
- If the queue is full (3 pending jobs), the relay returns 429 "Too many concurrent jobs"
- Jobs are forwarded to the OpenClaw instance one at a time in arrival order
- The second job starts immediately after the first response is received (no idle waiting)

**Response buffering for polling:** The relay receives the complete response from OpenClaw over WebSocket, stores it in `jobBuffer` (keyed by jobId), and returns it on the next `GET /{uid}/prompt/{jobId}` poll from the Cloud Function. Buffer entries expire after 5 minutes. The Cloud Function's 5-minute UI timeout aligns with this — if the user stops polling, the response is cleaned up automatically.

- If no OpenClaw instance connected for `{uid}`: relay returns 503 "OpenClaw not connected"
- Connection drops during job execution: relay returns 503 with `"job_lost": true` — Cloud Function surfaces "Brace disconnected mid-response. Please retry." toast
- Auth: `PROMPTROOT_AGENT_TOKEN` verified against `agentKeysByHash/{tokenHash}` on WebSocket connect (one Firestore read, then cached in memory for connection lifetime)

**OpenClaw plugin (`promptroot-relay`):**

```json
// openclaw.json
{
  "plugins": {
    "promptroot-relay": {
      "enabled": true
      // token read from env: PROMPTROOT_AGENT_TOKEN
    }
  }
}
```

The plugin:
- Reads `PROMPTROOT_AGENT_TOKEN` from env on startup
- Opens a WebSocket to `wss://relay.promptroot.io/connect` with token in header
- Receives incoming prompt jobs, executes them via the existing Brace runtime
- Streams response chunks back over the WebSocket
- Reconnects automatically on disconnect (exponential backoff)

**PromptRoot changes for Phase 3b:**
- Cloud Function updated: if user has no `gatewayUrl` stored (Phase 3a), call relay instead
- `openclawKeys/{uid}` gains `useRelay: boolean` field — set to `true` when user enables relay mode
- Settings page shows relay status: "Connected" / "Not connected" (relay exposes `GET /{uid}/status`)
- No user-facing URL configuration — relay is fully automatic once OpenClaw plugin is enabled

**Infrastructure:**
- Relay runs on Cloud Run (scales to zero, cost-effective) or a $5/mo VPS
- TLS terminated at the edge (Cloudflare or Cloud Run)
- Relay does not process prompt content — pure message forwarding
- Horizontal scaling: stateful (WebSocket connections) — sticky sessions required if multi-instance

**Acceptance criteria:**
- New user: install OpenClaw, add one config line, "Run in Brace" works in PromptRoot
- Relay status visible on OpenClaw settings page ("Connected" / "Not connected")
- If OpenClaw is offline, 503 surfaced as toast "Your OpenClaw isn't connected. Is it running?"
- Jesse's Phase 3a Cloudflare Tunnel setup continues to work unchanged

**Tasks:**
- [x] Build `relay.promptroot.io` Node.js service (`relay/index.js` — WebSocket server + HTTP job endpoints)
- [x] Fly.io deployment config (`relay/Dockerfile`, `relay/fly.toml` — 1 shared-CPU 1GB, `iad`, always-on)
- [x] Deployed to Fly.io as `promptroot-relay` app (`promptroot-relay.fly.dev`); scaled to 1 machine to avoid split-brain; `RELAY_SHARED_SECRET` + `FIREBASE_SERVICE_ACCOUNT` set as Fly secrets
- [x] Write OpenClaw `promptroot-relay` plugin (`~/.openclaw/extensions/promptroot-relay/index.js` — connects to `wss://promptroot-relay.fly.dev/connect` with `PROMPTROOT_AGENT_TOKEN`; does not reconnect on close code 4000)
- [x] `callOpenclawGateway` Cloud Function routes to relay when `useRelay: true` (503s until relay service is deployed)
- [ ] Add relay connection status indicator to OpenClaw settings page (`GET /{uid}/status`)
- [x] `brace-modal.js` offers relay vs custom-URL mode selector
- [x] Document relay setup in PromptRoot onboarding copy — `/pages/openclaw/openclaw.html` redesigned with hero, feature grid, 4-step relay setup guide, advanced custom-URL section, troubleshooting, and live connection status card

---

### Phase 4 — Web Capture Integration

**Depends on:** Phase 1 (for `gh api` polling approach) OR Phase 6 (preferred: use `GET /webclips` Agent API endpoint instead)

**Goal:** Brace monitors and summarizes Jesse's web clips

**Heartbeat latency decision:** Current heartbeat runs every 30 minutes. For web clip notifications, 30-minute latency is acceptable (clips are reference material, not urgent). No dedicated cron job needed. If this assumption changes, add a GitHub webhook to the repo that POSTs to an OpenClaw endpoint on push.

**Acceptance criteria:**
- New files in `webclips/jessewashburn/` are detected within one heartbeat cycle (≤30 min)
- Telegram notification includes filename and a one-sentence summary of the clip
- Summaries stored in `memory/YYYY-MM-DD.md`
- If GitHub API is unavailable: heartbeat logs the failure and retries next cycle (no crash)

**Implementation path:**
- **If Phase 6 is complete:** use `GET /webclips?since={lastHeartbeat}` via Agent API — preferred
- **If Phase 6 is not yet complete:** use `gh api repos/promptroot/promptroot/contents/webclips/jessewashburn` — interim only

**Tasks:**
- [ ] Add webclip monitoring to HEARTBEAT.md (with `since` timestamp tracking)
- [ ] Auto-summarize new clips via `summarize` skill (one sentence max for notification)
- [ ] Telegram notification for new clips
- [ ] Handle GitHub API unavailability gracefully (log, skip, retry next cycle)

---

### Phase 5 — Queue Integration (Interim — Superseded by Phase 6)

> ⚠️ **Phase 5 is an interim solution only.** If Phase 6 (Agent API) is less than 4 weeks away, skip Phase 5 and wait for the `PATCH /queue/{itemId}` endpoint instead. The service account approach below is more complex to maintain and has a wider credential surface than the Agent API token.

**Depends on:** Phase 1 (skill infrastructure)

**Goal:** Brace can execute `[brace]`-tagged queue items from PromptRoot without waiting for Phase 6

**Heartbeat latency decision:** 30-minute heartbeat latency is acceptable for queue execution — these are batch tasks, not real-time. If sub-30-minute execution is needed, add a `every 5 minutes` cron job to HEARTBEAT.md specifically for queue polling.

**Acceptance criteria:**
- Brace picks up `[brace]`-tagged queue items within one heartbeat cycle
- Completed tasks write a result summary back to the queue item in Firestore
- Failed tasks set `status: 'error'` visible in the PromptRoot queue UI
- Credential stored in OpenClaw secrets — not in any workspace file

**Tasks:**
- [ ] **Decision gate:** confirm Phase 6 is >4 weeks away before starting this phase
- [ ] Provision Firestore service account (least-privilege: read `julesQueues`, write `result` and `status` fields only)
- [ ] Store service account JSON in OpenClaw secrets manager (not workspace files)
- [ ] Build `promptroot-queue` skill
- [ ] Process `[brace]`-tagged queue items via sub-agents
- [ ] Migrate to Phase 6 Agent API (`PATCH /queue/{itemId}`) once available; decommission service account

---

---

### Phase 6 — Agent API

**Goal:** OpenClaw can fully operate PromptRoot via a REST API without browser automation

**Acceptance criteria:**
- All endpoints return correct data for valid agent tokens
- Invalid/missing token returns 401; requests for other users' data return 403
- Rate limiting enforced (60 req/min per token)
- API key can be issued, rotated, and revoked from the PromptRoot UI
- `PROMPTROOT_AGENT_TOKEN` stored in OpenClaw's env and available to all skills

**Token storage on Brace's side:**
The raw agent token is added to OpenClaw's shell environment after generation:
```bash
# ~/.bashrc (or OpenClaw shellEnv config)
export PROMPTROOT_AGENT_TOKEN="pra_abc123..."
```
All Brace scripts and skills reference `$PROMPTROOT_AGENT_TOKEN` — never hardcode the token. The token is also added to OpenClaw's secrets config so it persists across reinstalls.

**Tasks:**
- [x] Design and document final API contract (this section)
- [x] Implement `agentKeys/{uid}` + `agentKeysByHash/{tokenHash}` Firestore collections + security rules (deny-all: admin SDK only)
- [x] Implement `src/modules/agent-keys.js` — key generation (multiple named tokens), display, revocation UI
- [x] Implement Cloud Function `agentApi` (`onRequest` HTTP handler, all routes) — `us-central1-promptroot-b02a2.cloudfunctions.net/agentApi`
- [x] Add in-memory rate limiting to `agentApi` (60 req/min per token, `Map<tokenHash, { count, windowStart }>`)
- [x] Implement Cloud Function `manageAgentKeys` (`onRequest`, Firebase ID token auth) — CRUD for agent keys
- [x] Add API key management page at `pages/agent-api/agent-api.html`
- [x] Add `Agent API` nav link to header (desktop + mobile top nav)
- [x] Add `src/styles/pages/agent-api.css` and import in `src/styles.css`
- [x] Add `/agent-api` rewrite to `firebase.json`
- [x] Deploy Cloud Functions: `cd functions && npm run deploy` (deployed 2026-03-22, all 12 functions updated)
- [ ] After generating token: add `PROMPTROOT_AGENT_TOKEN` to `~/.bashrc` and OpenClaw secrets config
- [ ] Write integration tests (Brace calls each endpoint, verifies response shape)

---

### Phase 7 — Brace Web UI (Open WebUI on fly.io)

**Depends on:** Phase 0 (`chatCompletions` endpoint enabled), Cloudflare Tunnel from Phase 3a

**Goal:** Jules/Codex-style multi-session web UI for Brace — parallel conversations, full history, streaming — with "Run in Brace" opening a new tab instead of an inline panel. Reuses Open WebUI rather than building a custom frontend.

**Architecture:**
```
Open WebUI (fly.io: brace-ui.fly.dev)
  └── OPENAI_API_BASE_URL = https://<cloudflare-tunnel-url>/v1
        └── Cloudflare Tunnel → OpenClaw gateway (:18789)
                               POST /v1/chat/completions (enabled Phase 0)
```

Each browser tab = an independent session. OpenClaw handles them in parallel via its native multi-session runtime. History stored in SQLite on a persistent fly.io volume.

**"Run in Brace" new-tab flow (replaces inline response panel for Jesse):**
1. User clicks "Run in Brace" on a prompt
2. If template has unfilled `{PLACEHOLDERS}`: variable substitution modal fires (existing behavior)
3. Once prompt is complete: `window.open('https://brace-ui.fly.dev/?q=' + encodeURIComponent(filledPrompt), '_blank')`
4. Open WebUI receives `?q=` param, pre-fills the input, auto-sends

**Phase 3a/3b inline panel:** Retained for future multi-user path (other users won't have their own Brace UI instance). For Jesse, the new-tab flow supersedes it.

**Security:** `OPENAI_API_KEY` (= `OPENCLAW_GATEWAY_TOKEN`) lives in fly.io secrets only — never in `fly.toml` or client-side code. Open WebUI handles its own login so the gateway token is never exposed to the browser.

**Acceptance criteria:**
- `https://brace-ui.fly.dev` loads and connects to OpenClaw
- Multiple parallel sessions work (open two tabs, both respond independently)
- "Run in Brace" on PromptRoot opens new tab with prompt pre-filled
- Chat history persists across fly.io deploys (volume mounted)
- App name shows "Brace" (not "Open WebUI")

**Tasks:**
- [x] Enable `gateway.openai.chatCompletions: true` in `openclaw.json` (Brace repo PR #3)
- [x] Add `deploy/brace-ui/fly.toml` and `deploy/brace-ui/README.md` (Brace repo PR #3)
- [x] First deploy: `fly launch --no-deploy --copy-config --name brace-ui`
- [x] Create persistent volume: `fly volumes create brace_data --region iad --size 1`
- [x] Set fly secrets: `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `WEBUI_SECRET_KEY`
- [x] `fly deploy` — `brace-ui.fly.dev` live and serving 200 OK
- [x] Admin account created (first-user signup flow)
- [x] Verify chat works end-to-end — confirmed working via promptroot-relay
- [x] Update "Run in Brace" button: open new tab (`brace-ui.fly.dev/?q=<prompt>`) instead of inline panel — verified working end-to-end
- [x] Set `WEBUI_URL` — not needed; URL hardcoded client-side; `functions:config` API is deprecated
- [ ] Branding: upload logo in Open WebUI admin settings (name "Brace" already set via env)

**fly.toml (final working config):**
```toml
app = 'brace-ui'
primary_region = 'iad'

[build]
  image = 'ghcr.io/open-webui/open-webui:main'

[deploy]
  strategy = 'immediate'   # required: Open WebUI takes ~2.5min to start; default deploy waits 15s and fails

[env]
  WEBUI_NAME = 'Brace'
  ENABLE_SIGNUP = 'false'          # first user becomes admin; no open registration
  ENABLE_IMAGE_GENERATION = 'false'
  ENABLE_COMMUNITY_SHARING = 'false'
  ENABLE_MESSAGE_RATING = 'false'
  DEFAULT_USER_ROLE = 'admin'
  PORT = '8080'
  ENABLE_RAG_WEB_SEARCH = 'false'
  HF_HOME = '/app/backend/data/.cache/huggingface'   # persist embedding model on volume

[[mounts]]
  source = 'brace_data'
  destination = '/app/backend/data'   # SQLite history + config + model cache

[http_service]
  force_https = true
  auto_stop_machines = 'off'   # must be off: machine stops before slow first-boot completes otherwise
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  size = 'shared-cpu-1x'
  memory = '2048mb'   # 1024mb is not enough — OOM-killed during ML library startup
```

**Deployment learnings (hard-won):**

1. **Memory: 2048MB minimum.** Open WebUI loads PyTorch + sentence-transformers + LangChain at startup. On 1024MB the kernel OOM-kills the Python process at ~135s with no error log (exit code 137). The process crashes silently — no useful log output to diagnose it; use `fly machine status <id>` and look for `oom_killed=true` in the event log.

2. **Do NOT set `RAG_EMBEDDING_ENGINE=openai`.** Despite sounding like it would prevent a local model download, this env var causes Open WebUI to call `{OPENAI_API_BASE_URL}/v1/embeddings` at startup. Our OpenClaw gateway doesn't implement `/v1/embeddings`, so the call fails after a ~80s timeout and crashes the process. Same silent crash at ~135s, no log.

3. **Cache the HuggingFace model on the volume.** Open WebUI downloads `sentence-transformers/all-MiniLM-L6-v2` (30 files, ~68MB) from HuggingFace on first use. By default this goes to `/root/.cache/huggingface/` inside the container, which is ephemeral and re-downloaded every boot. Setting `HF_HOME=/app/backend/data/.cache/huggingface` stores it on the persistent volume. First boot: ~70 second download. Every subsequent boot: instant (`122164 it/s`).

4. **First-boot crash+restart is normal.** On a freshly provisioned volume, Open WebUI's first Python process run crashes/restarts once (unknown reason — likely a DB initialization race). The second run always succeeds. This is not a config issue; don't chase it.

5. **`strategy = 'immediate'` is required.** Fly's default deploy strategy waits for the app to respond before declaring success. Open WebUI takes ~2.5 minutes to fully start. Without `immediate`, `fly deploy` times out ("gave up after 15 attempts") even though the machine is fine.

6. **`auto_stop_machines = 'off'` during initial setup.** With `auto_stop_machines = 'stop'`, fly stops the machine when no traffic arrives. On first boot the app isn't serving yet (no traffic), so fly stops it mid-initialization. Use `'off'` until confirmed stable; can re-enable later for cost savings, but expect the first request after a cold start to wait ~3 minutes.

7. **Health check grace_period is capped at 60s.** `[http_service.checks]` grace_period > 60s is silently lowered to 60s with a warning. Open WebUI takes 150s+ to start, so this check will always fail until the app is up. Since `[[http_service.checks]]` is omitted from the current config, fly uses TCP-level routing (port open = healthy), which works correctly.

---

## Vector 8: PromptRoot Agent API

A dedicated REST API exposed via a single Cloud Function (`agentApi`) so OpenClaw can read and write all PromptRoot data without browser automation. Scoped to the authenticated user — one agent token per user.

### Authentication

```
Authorization: Bearer {PROMPTROOT_AGENT_TOKEN}
```

Agent tokens are:
- Generated **client-side** (cryptographically random, 32 bytes, hex-encoded with `pra_` prefix) — format: `pra_` + 64 hex chars = 68 chars total
- The browser computes SHA-256 of the raw token; only the hash is sent to the Cloud Function — raw token never reaches the server
- Multiple named tokens per user are supported (a user can have separate tokens for OpenClaw dev, prod, a script, etc.)
- Issued once, shown to the user once (same UX as a GitHub PAT)
- Each token individually revocable from `pages/agent-api/`

On each request, `agentApi` hashes the bearer token (SHA-256 in Node's webcrypto), looks up `agentKeysByHash/{hash}` to get the uid, then confirms the token entry exists in `agentKeys/{uid}.tokens`. No decryption needed — the token IS the credential.

**Two Cloud Functions handle the token lifecycle:**
- `manageAgentKeys` — `onRequest`, authenticated via **Firebase ID token** (Browser calls `user.getIdToken()` and sends as Bearer). Handles create, list, revoke. Uses Firestore batch writes. URL: `https://us-central1-promptroot-b02a2.cloudfunctions.net/manageAgentKeys`
- `agentApi` — `onRequest`, authenticated via **agent bearer token** (`pra_...`). Serves the data API. URL: `https://us-central1-promptroot-b02a2.cloudfunctions.net/agentApi`

**Firestore collections:**
```
agentKeys/{uid}
  tokens: [             // array — multiple tokens per user
    {
      tokenHash: string     // SHA-256 of the raw token, hex
      label: string         // user-set label, e.g. "OpenClaw dev"
      createdAt: timestamp
      lastUsedAt: timestamp
    }
  ]

agentKeysByHash/{tokenHash}
  uid: string           // reverse lookup: tokenHash → uid (for relay auth and agentApi auth)
  createdAt: timestamp
```

`agentKeysByHash` is written and deleted atomically with `agentKeys` by the Cloud Function (Firestore batch write). The relay uses it to resolve an incoming bearer token to a uid without scanning all `agentKeys` documents.

Firestore rules (server-side only — no direct client access):
```
match /agentKeys/{userId} {
  allow read, write: if false;  // Cloud Function admin SDK only
}
match /agentKeysByHash/{tokenHash} {
  allow read, write: if false;  // Cloud Function admin SDK only
}
```

---

### API Contract

Base URL: `https://us-central1-promptroot-b02a2.cloudfunctions.net/agentApi`

All responses are `application/json`. Errors follow:
```json
{ "error": "message", "code": "ERROR_CODE" }
```

---

#### Prompts

```
GET /prompts?branch=main&path=prompts/
```
List all prompt files in a directory. Proxies the GitHub tree API.

```json
{
  "branch": "main",
  "path": "prompts/",
  "files": [
    { "slug": "tutorial/templates/versioned-modular-sdd-plan", "path": "prompts/tutorial/templates/versioned-modular-sdd-plan.md" },
    ...
  ]
}
```

---

```
GET /prompts/{slug}?branch=main
```
Fetch the raw markdown for a prompt by slug. Proxies GitHub raw content.

```json
{
  "slug": "tutorial/templates/versioned-modular-sdd-plan",
  "branch": "main",
  "content": "# Versioned SDD Plan...",
  "placeholders": ["PLAN_VERSION", "DATE", "FEATURE_REQUEST_TEXT"],
  "conditionalFlags": ["INCLUDE_UI_CHANGES", "INCLUDE_UNIT_TESTS", ...]
}
```

Note: `placeholders` and `conditionalFlags` are detected server-side using the same regex as the frontend (`variable-substitution.js`), so Brace doesn't have to parse them.

---

```
POST /prompts/render
Content-Type: application/json

{
  "slug": "tutorial/templates/versioned-modular-sdd-plan",
  "branch": "main",
  "values": {
    "PLAN_VERSION": "v1.0",
    "DATE": "2026-03-18",
    "FEATURE_REQUEST_TEXT": "Add OpenClaw integration",
    "INCLUDE_UNIT_TESTS": true,
    "INCLUDE_E2E_TESTS": false
  }
}
```

Returns the fully rendered prompt with variables substituted and conditional blocks resolved — Brace gets a ready-to-use string with no further processing needed.

```json
{
  "rendered": "# Versioned SDD Plan - v1.0\n\nDate: 2026-03-18\n..."
}
```

---

#### Queue

```
GET /queue?status=pending&limit=20
```
List the authenticated user's Jules queue items.

```json
{
  "items": [
    {
      "id": "abc123",
      "promptText": "...",
      "status": "pending",
      "createdAt": "2026-03-18T10:00:00Z",
      "scheduledAt": null,
      "tags": ["[brace]"]
    }
  ]
}
```

---

```
POST /queue
Content-Type: application/json

{
  "promptText": "Refactor auth module to use async/await",
  "tags": ["[brace]"],
  "scheduledAt": null
}

→ 201 Created
{
  "id": "abc123",
  "promptText": "...",
  "status": "pending",
  "createdAt": "2026-03-18T10:00:00Z"
}
```

Add an item to the queue. Returns the created item with its ID.

---

```
PATCH /queue/{itemId}
Content-Type: application/json

{
  "status": "complete",
  "result": "Refactoring complete. PR #123 created."
}
```

Update a queue item — used by Brace to write results back after executing a task.

Allowed field updates: `status`, `result`, `tags`, `scheduledAt`.

---

```
DELETE /queue/{itemId}
```

Remove a queue item.

---

#### Web Clips

```
GET /webclips?limit=20&since=2026-03-17T00:00:00Z
```

List web clips for the authenticated user from `webclips/{username}/`. Proxies GitHub tree/contents API.

```json
{
  "clips": [
    {
      "filename": "my-article-2026-03-18.md",
      "path": "webclips/jessewashburn/my-article-2026-03-18.md",
      "committedAt": "2026-03-18T09:00:00Z",
      "downloadUrl": "https://raw.githubusercontent.com/..."
    }
  ]
}
```

---

```
GET /webclips/{filename}
```

Fetch the full markdown content of a specific web clip.

---

```
POST /webclips
Content-Type: application/json

{
  "filename": "brace-summary-2026-03-18.md",
  "content": "# Summary\n..."
}
```

Commit a new file to `webclips/{username}/` via the GitHub Contents API. Useful for Brace to write summaries or notes back into PromptRoot's repository.

> ⚠️ **Scope verification required:** This endpoint requires the stored GitHub OAuth token to have `contents: write` scope. The current PromptRoot OAuth flow must be audited to confirm this scope is requested. If it isn't, users will get a 403 from GitHub on this endpoint and the OAuth scopes will need to be updated in the Firebase OAuth config and `oauth-callback.html`. Verify before implementing `POST /webclips`.

---

#### Sessions (read-only)

```
GET /sessions?limit=10&page=1
```

List Jules session history for the authenticated user.

```json
{
  "sessions": [
    {
      "sessionId": "abc123",
      "promptText": "...",
      "createdAt": "2026-03-18T10:00:00Z",
      "status": "complete"
    }
  ]
}
```

---

#### Agent API Key Management

Key management is handled by a **separate** Cloud Function (`manageAgentKeys`) authenticated with a **Firebase ID token** — not an agent token. This separation means you can manage keys even if all existing tokens are revoked.

Base URL: `https://us-central1-promptroot-b02a2.cloudfunctions.net/manageAgentKeys`

All requests: `POST` with `Authorization: Bearer {FIREBASE_ID_TOKEN}` and JSON body `{ "action": "..." }`.

```
{ "action": "list" }
→ { "tokens": [{ "tokenHash", "label", "createdAt", "lastUsedAt" }] }
```

```
{ "action": "create", "tokenHash": "...", "label": "OpenClaw dev" }
```

The **client generates the token** (`pra_` + 32 random bytes), computes SHA-256 client-side, and sends only the hash to the function. The raw token is displayed once in the UI — never stored server-side.

```
→ { "ok": true }
```

```
{ "action": "revoke", "tokenHash": "..." }
→ { "ok": true }
```

Multiple tokens per user are supported. Each token is individually labeled and revocable. All subsequent requests with a revoked token return 401.

---

### Rate Limiting

- 60 requests per minute per token
- **Do not use Firestore counters** — Firestore has a hard 1 write/second limit per document, which would throttle the rate limiter itself under any meaningful load
- Enforced using an **in-memory counter per Cloud Function instance** (`Map<tokenHash, { count, windowStart }>`), reset every 60 seconds
- Limitation: in-memory counters are not shared across Cloud Function instances (multiple instances = independent counters). This is acceptable — the limit is a best-effort abuse guard, not a strict billing cap. If strict cross-instance enforcement is needed later, use Redis (Cloud Memorystore) or Firebase App Check.
- Exceeding the limit returns `429 Too Many Requests` with a `Retry-After: 60` header

### Implementation Notes

- `agentApi` is a single `onRequest` Cloud Function with internal routing (not one function per endpoint) to minimize cold start surface area — **built**
- Key management is a separate `manageAgentKeys` `onRequest` function (Firebase ID token auth, not agent token auth) — **built**
- GitHub API calls for `GET /prompts` and `GET /webclips` use unauthenticated GitHub API (public repos); `POST /webclips` would require a stored GitHub token with `contents: write` scope — not yet implemented, see open question #3
- Queue endpoints read/write `julesQueues/{uid}/items` directly via admin SDK — **built**
- `POST /prompts/render` uses a simple regex substitution (`{VAR_NAME}` → value) inline in the function — a shared `functions/utils/variable-substitution.js` module would be cleaner but is not yet extracted; conditional `{{#if}}` block rendering is not yet implemented server-side
- GitHub API responses are not cached server-side in the current implementation (no TTL caching in the Cloud Function) — acceptable for initial rollout; add if rate limits become an issue

---

---

## UI Changes

### Phase 3 — "Run in Brace" Button

**Prompt viewer action bar** (`src/modules/prompt-viewer.js`)
- Add "🦞 Run in Brace" button alongside the Jules "⚡ Try in Jules" button
- Disabled state with tooltip `"Set up OpenClaw token in Settings"` when no token stored
- **Phase 7 behavior (current):** on click, open `https://brace-ui.fly.dev/?q=<encoded prompt>` in a new tab — no inline panel, no polling. Variable substitution modal fires first if template has unfilled placeholders.
- **Phase 3a/3b behavior (retained for multi-user):** for users without a Brace UI instance, the original inline response panel flow remains as a fallback — detect via `openclawKeys/{uid}.useWebUi` flag (or absence of `WEBUI_URL` config).

**Brace response panel** (`src/modules/brace-response-panel.js`) *(Phase 3a/3b path only)*
- Renders below the prompt viewer, hidden by default
- States: `pending` (animated spinner + "Waiting for Brace…"), `complete` (rendered markdown), `error` (error message + retry button), `timeout` (5-minute limit reached)
- Response rendered via `marked.js` + DOMPurify (same pipeline as prompt renderer)
- "Copy response" button (top-right corner of panel)
- "Close" button collapses the panel
- Polling interval: 3 seconds; timeout: 5 minutes

**Token entry modal** (`src/modules/brace-modal.js`)
- Triggered automatically on first "Run in Brace" click if no connection configured
- **Mode selector** (radio buttons at the top): "Use PromptRoot Relay" (default) / "Use my own URL"
  - **Relay mode:** shows only a password input for the gateway token (used as `PROMPTROOT_AGENT_TOKEN`). Copy-paste from the Agent API page. Note: requires Phase 6 — if no agent token has been generated, show an inline link "Generate a token first →" pointing to `pages/agent-api/`.
  - **Custom URL mode** (Phase 3a / advanced): shows two inputs — gateway URL (`https://...`) and gateway token. Intended for users running a Cloudflare Tunnel or self-hosted gateway.
- "Save" and "Cancel" buttons
- Mode selection and values persist to `openclawKeys/{uid}` (`useRelay` + optional `gatewayUrl`)

**Brace response panel styles** (`src/styles/components/brace-response-panel.css`)
- Styles for the panel container, all 4 states (pending/complete/error/timeout), copy button
- Import added to `src/styles.css`

**OpenClaw settings page** (`pages/openclaw/openclaw.html`)
- New page in `pages/` directory (mirrors `pages/jules/`)
- Shows: token status (stored / not stored), "Revoke token" button, date stored
- Nav link added to header under user menu: `partials/header.html` → user dropdown → "Settings" group
- CSS: `src/styles/pages/openclaw.css`

---

### Phase 5 — Queue: Brace Tag + Result Display

**Queue item card** (`src/modules/jules-queue.js`)
- `[brace]` tag renders with a distinct style (e.g. teal badge) separate from Jules tags
- When `status === 'complete'` and `result` field is present: expandable "Brace result" section below the prompt text, rendered as plain text
- Failed Brace tasks (`status === 'error'`) show the same error state as Jules failures

---

### Phase 6 — Agent API Key Management Page ✅ Built

**New page** (`pages/agent-api/agent-api.html`) — routed at `/agent-api`
- Nav link added to `partials/header.html` **top nav** (desktop + mobile) — `api` Material icon, "Agent API" label
- Sections built:
  1. **New Token** — label input + "Generate Token" button; client generates `pra_` token, computes SHA-256, calls `manageAgentKeys` Cloud Function
  2. **One-time reveal panel** — appears after generation; warning banner, monospace token display, "Copy Token" + "Dismiss" buttons; panel hidden after dismiss
  3. **Active Tokens** — list of all tokens with label, created date, last-used date, individual "Revoke" button per token
  4. **API Reference** — inline endpoint list, base URL, auth header format
- Multiple named tokens per user (not a single token)
- CSS: `src/styles/pages/agent-api.css` (imported in `src/styles.css`)
- Firebase rewrite: `{ "source": "/agent-api", "destination": "/pages/agent-api/agent-api.html" }`

**Files created:**
- `src/modules/agent-keys.js` — token generation, SHA-256 hashing, `manageAgentKeys` calls, DOM rendering
- `pages/agent-api/agent-api.html` — page HTML
- `src/pages/agent-api-page.js` — page init (mirrors `jules-page.js`)
- `src/styles/pages/agent-api.css`

---

## Unit Test Plan

All new test files go in `src/unit-tests/modules/` or `src/unit-tests/utils/`.

### Shell scripts: `fetch-prompt.bats`, `list-prompts.bats`

[Bats](https://github.com/bats-core/bats-core) smoke tests for the Phase 1 shell scripts. Run as part of CI or manually before Phase 1 sign-off.

`fetch-prompt.bats`:
- Valid slug returns non-empty markdown output
- Invalid slug returns non-zero exit code and error message
- Missing `owner/repo` argument prints usage and exits 1
- GitHub rate limit response (HTTP 429) prints error and exits 1

`list-prompts.bats`:
- Returns at least one `.md` file path for `promptroot/promptroot main`
- Missing `owner/repo` argument prints usage and exits 1
- Invalid repo returns non-zero exit code

---

### `openclaw-keys.test.js`

Mirrors `jules-keys.test.js`. Cover:
- `encryptAndStoreOpenclawKey(plaintext, uid)` — encrypts and writes to Firestore
- `checkOpenclawKey(uid)` — returns true/false based on doc existence
- `deleteStoredOpenclawKey(uid)` — clears Firestore doc and cache
- `getDecryptedOpenclawKey(uid)` — returns plaintext from encrypted doc
- Cache hit/miss (5-minute TTL)
- Missing `key` field in doc → returns false
- Firestore unavailable → throws / returns false gracefully

### `openclaw-api.test.js`

- `sendToBrace(text)` — calls `callOpenclawGateway` Cloud Function, returns `jobId`
- `pollJob(jobId)` — calls `pollOpenclawJob`, returns `{ status, output }`
- No token stored → throws with actionable error
- Cloud Function error → propagates as toast-friendly message
- `sendToBrace` with empty text → returns early without calling function

### `brace-modal.test.js`

- Modal renders with a password input and Save/Cancel buttons
- Cancel closes modal without saving
- Save with empty input shows validation error
- Save with valid token calls `encryptAndStoreOpenclawKey` and closes modal
- Modal is focus-trapped while open
- ESC key closes modal (calls cancel handler)

### `brace-response-panel.test.js`

- Panel is hidden on init
- `showPanel()` makes panel visible and sets status to `pending`
- `updatePanel({ status: 'complete', output: '...' })` renders markdown output
- `updatePanel({ status: 'error' })` shows error state with retry button
- Output is sanitized via DOMPurify before render
- `hidePanel()` collapses panel and clears content
- Timeout after 5 minutes calls `updatePanel({ status: 'timeout' })`

### `agent-keys.test.js`

- `generateTokenString()` — returns string matching `/^pra_[0-9a-f]{64}$/`
- `sha256Hex(token)` — returns 64-char hex string deterministically
- `initAgentKeys(user)` — shows loading, calls `manageAgentKeys` list action, renders token list
- `renderAgentKeysList(user)` — empty state shows "No API tokens yet"
- `handleGenerateClick(user)` — no label → toast "Please enter a label"; valid label → calls create action
- `handleRevokeClick(tokenHash, label, user)` — confirm cancel → no call; confirm OK → calls revoke action, refreshes list
- `showGeneratedToken(token)` — panel becomes visible, copy button copies token, dismiss hides panel
- `callManageKeys(idToken, payload)` — non-200 response → throws with error message

### Cloud Function: `agentApi` routing (`functions/`)

- Valid token → routes to correct handler
- Missing `Authorization` header → 401
- Malformed token (not hex-encoded) → 401
- Token not in `agentKeys` → 401
- Rate limit exceeded → 429 with `Retry-After` header
- `GET /prompts` → returns file list from GitHub proxy
- `POST /prompts/render` with values → returns substituted+rendered markdown
- `GET /queue` → returns user's queue items
- `PATCH /queue/{itemId}` with disallowed fields → 400
- `DELETE /queue/{itemId}` for item belonging to other user → 403
- `POST /webclips` → commits file via GitHub Contents API
- Unknown route → 404

### Shared utility: `functions/utils/variable-substitution.test.js`

Extract and test the server-side version of the substitution logic used by `POST /prompts/render`:
- `detectPlaceholders(text)` — matches `{WORD}` patterns
- `detectConditionalFlags(text)` — matches `{{#if FLAG}}` patterns
- `renderConditionalBlocks(text, values)` — includes/excludes blocks
- `substitutePlaceholders(text, values)` — replaces placeholders
- XSS strings in values are stripped (DOMPurify equivalent for Node)

---

## E2E Test Plan

All new E2E tests go in `e2e-tests/e2e/extended/` (not smoke — these require auth + token setup).

### Phase 3: "Run in Brace" flow (`brace-button.spec.js`)

**Setup:** Mock the `callOpenclawGateway` and `pollOpenclawJob` Cloud Functions to return fixture responses.

| Test | Steps | Assert |
|------|-------|--------|
| Button visible when token stored | Store mock token in Firestore, load prompt viewer | "Run in Brace" button is enabled |
| Button disabled when no token | Load prompt viewer with no token | Button is disabled, tooltip present |
| First-click token setup | Click button with no token | Brace modal opens |
| Token save flow | Enter token in modal, click Save | Modal closes, button enabled |
| Successful run | Click "Run in Brace", mock returns complete | Response panel shows rendered markdown |
| Pending state | Mock returns `pending` for 2 polls | Panel shows spinner |
| Error state | Mock returns error | Panel shows error message and retry button |
| Retry button | Click retry after error | `sendToBrace` called again |
| Timeout | Mock never returns complete | Panel shows timeout message after 5 min (use fake timers) |
| Copy response | Successful run, click "Copy response" | Clipboard contains Brace output text |
| Close panel | Click Close on response panel | Panel collapses, button re-enabled |

---

### Phase 6: Agent API key management (`agent-api.spec.js`)

| Test | Steps | Assert |
|------|-------|--------|
| No tokens state | Visit `/agent-api`, no tokens in Firestore | "No API tokens yet" shown |
| Label required | Click Generate with empty label | Toast "Please enter a label" |
| Generate token | Enter label, click Generate | One-time reveal panel appears with `pra_...` token |
| Copy token | Click "Copy Token" in reveal panel | Clipboard contains the `pra_...` token |
| Dismiss panel | Click Dismiss | Reveal panel hidden |
| Token appears in list | After generate + dismiss | Token row shows label + "Never used" |
| Multiple tokens | Generate two tokens with different labels | Both rows shown in list |
| Revoke token | Click Revoke, confirm | Token row removed |
| Revoke cancel | Click Revoke, cancel confirm dialog | Token row still present |
| Last used timestamp | Make an API call, reload page | "Last used" timestamp updated in list |

---

### Phase 6: Agent API endpoint smoke (`agent-api-endpoints.spec.js`)

Use `request` (Playwright API testing) against the deployed or emulated Cloud Function.

| Test | Endpoint | Assert |
|------|----------|--------|
| Auth: missing token | `GET /prompts` | 401 |
| Auth: invalid token | `GET /prompts` with bad token | 401 |
| List prompts | `GET /prompts?branch=main` | 200, array of file objects |
| Fetch prompt | `GET /prompts/tutorial/templates/versioned-modular-sdd-plan` | 200, `content` field present, `placeholders` detected |
| Render prompt | `POST /prompts/render` with values | 200, `rendered` is substituted string |
| List queue | `GET /queue` | 200, `items` array |
| Add queue item | `POST /queue` | 201, item with `id` returned |
| Update queue item | `PATCH /queue/{id}` with `status: 'complete'` | 200 |
| Delete queue item | `DELETE /queue/{id}` | 204 |
| List webclips | `GET /webclips` | 200, `clips` array |
| Rate limit | 61 rapid requests | 61st returns 429 with `Retry-After` |

---

## Open Questions (must resolve before implementation)

| # | Question | Blocks |
|---|----------|--------|
| 1 | Does the OpenClaw gateway expose `POST /api/prompt` and `GET /api/prompt/{jobId}` today? | Phase 3a |
| 2 | Cloudflare Tunnel or Tailscale for Phase 3a (Jesse's own setup)? | Phase 3a Cloud Function config |
| 3 | Does the current GitHub OAuth flow request `contents: write` scope? | `POST /webclips` |
| 4 | ~~Cloud Run or VPS for `relay.promptroot.io`?~~ **Resolved:** Fly.io — single shared-CPU 256MB instance, `iad`. No sticky session complexity; in-memory state is fine for MVP. | Phase 3b |
| 5 | Does the OpenClaw `promptroot-relay` plugin need to be upstreamed to OpenClaw repo, or is it a local plugin only? | Phase 3b |
| 6 | Does Jesse have a domain on Cloudflare for the named tunnel? If not, decide: accept URL-update friction of quick tunnel, or get a domain. | Phase 3a |
| 7 | What is `RELAY_SHARED_SECRET` rotation plan? If the secret leaks, the relay inbound is open. Document rotation procedure before Phase 3b ships. | Phase 3b |

## Notes

- Phase 0 (gateway spike) is the highest-priority unresolved item — Phase 3a cannot start without it
- Phase 1 is pure read — zero risk, high value, start here in parallel with Phase 0
- Phase 3a (Cloudflare Tunnel) ships fast for Jesse; Phase 3b (relay) is the multi-user path — build 3a first
- Phase 3a: use a **named tunnel** (not quick tunnel) to avoid URL churn on restart — requires a Cloudflare account and domain
- **Phase 3b relay service is built** (`relay/` in repo) — Fly.io (`promptroot-relay` app, `iad`, 1 shared-CPU 256MB, always-on). Pending: `fly deploy` + OpenClaw plugin
- Relay is in-memory, not stateless — relay restarts drop in-flight jobs; this is acceptable for MVP
- `RELAY_SHARED_SECRET` must be set at deploy time on both Cloud Function and relay; document rotation procedure before Phase 3b ships
- Phase 5 (service account queue) is interim only — do not build it if Phase 6 is <4 weeks away
- Implementation language: polling (3s interval), not streaming — relay uses WebSocket internally but PromptRoot side is still HTTP polling
- Variable substitution (`{PLACEHOLDER}`) is shared syntax between PromptRoot's UI modal and Brace's interactive prompting — keep in sync if syntax changes
- All Brace scripts must accept `owner/repo` and `branch` as parameters — never hardcode `promptroot/promptroot`
- `PROMPTROOT_AGENT_TOKEN` stored in `~/.bashrc` and OpenClaw secrets after Phase 6 key generation — format: `pra_` + 64 hex chars
- PR #769 (`versioned-modular-sdd-plan.md` + conditional `{{#if}}` blocks) is the reference template for Phase 1 testing; pull from `main` once merged
- **Phase 6 is complete** (PromptRoot side) — pending: Cloud Function deploy (`cd functions && npm run deploy`), then generate first token and add to `~/.bashrc`
- **Phase 3a/3b PromptRoot side is complete** (PR #777) — `callOpenclawGateway` + `pollOpenclawJob` are built and route correctly; Phase 3a is usable once Phase 0 (gateway spike) is done and functions are deployed; Phase 3b relay mode returns 503 until `relay.promptroot.io` is deployed
- Phase 5 (service account queue) should not be built — Phase 6 is already done
- **Phases 1 and 2 complete** — scripts, SKILL.md, Bats tests (12/12), extraction heuristic in HEARTBEAT.md, contribution workflow in SKILL.md, `[brace-generated]` label created
- **Remaining unblocked work:** logo upload (cosmetic), Phase 2 end-to-end test (trigger a real contribution)
- **Cloud Functions deployed 2026-03-22** — all 12 functions live; Phase 3a curl test and Phase 6 token UI now unblocked
- **Remaining blocked work:** Phase 3a end-to-end test (blocked on Cloud Function deploy + tunnel setup)
- **Phase 7 is functionally complete** — "Run in Brace" opens new tab, chat routes through relay to Claude, verified end-to-end
- **Phase 7 supersedes Phase 3 inline panel for Jesse** — the new-tab Open WebUI path is the preferred "Run in Brace" experience. The inline panel is retained as the multi-user fallback path for users who don't have their own Brace UI.
- **Brace Web UI config:** `deploy/brace-ui/fly.toml` + README committed in Brace repo; gateway config key is `gateway.http.endpoints.chatCompletions.enabled`
- **Open WebUI chosen over custom React frontend** — handles multi-session, history, streaming, file attachments; connects to OpenClaw's existing `/v1/chat/completions` endpoint with no custom code
- **`brace-ui.fly.dev` is live** — chat working end-to-end via promptroot-relay; relay SSE fix: use `Buffer.from(chunk).toString('utf8')` not `chunk.toString()` (Uint8Array in Node 22)
