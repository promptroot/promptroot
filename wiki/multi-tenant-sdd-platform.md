---
title: Multi-Tenant SDD Platform — PromptRoot as the Wiki Host
slug: multi-tenant-sdd-platform
date: 2026-04-26
status: shipped
owner: jesse
tags: [platform, wiki, rag, multi-tenant, firestore, sdd]
visibility: public
related:
  - dev-history-wiki
  - vscode-wiki-integration
---

# SDD: Multi-Tenant SDD Platform — PromptRoot as the Wiki Host

**Project:** PromptRoot (web app + Cloud Functions + agent integrations)
**Document Type:** Software Design Document (SDD)
**Date:** 2026-04-26
**Last updated:** 2026-07-26
**Status:** shipped (PR #814). Amended 2026-07-26 by a security-hardening pass (see the Security Hardening addendum below), which makes wikis private-by-default and removes every public-access path. The addendum supersedes the public-access portions of §3.4, §3.10, §5, W1, and W6.

---

## 0. Security Hardening addendum (2026-07-26)

**Motivation.** The original design allowed `visibility: public` tenants and SDDs, an anonymous `ragQuery` path, and a world-readable full-text bundle. For proprietary specs that is unacceptable: content leaked to the public internet, to any signed-in user (via a broken legacy rule), and to anyone with Firebase project access. This pass closes the public and cross-user exposures. It does **not** add at-rest encryption (see "Still open" below).

**Shipped (commits `1d6f5b7`, `e3ede0b`, `e4bbaa4` on `main`; pending `firebase deploy`):**

1. **No public wikis.** `createTenant` forces `visibility: 'private'` and `updateTenant` rejects any non-private value (`functions/wiki.js`). The public option was removed from the tenants UI (`pages/tenants/tenants.html`, `src/pages/tenants-page.js`).
2. **Firestore locked to Cloud Functions.** `wikiDocs`, `wikiChunks`, `tenants`, `sdds`, `versions`, and `tenantChunks` are now `allow read, write: if false` (`config/firestore/firestore.rules`). All content is reached only through the Admin-SDK functions, which enforce membership. This also fixes the broken legacy rule that let any authenticated user read a "private" `wikiDocs`.
3. **`ragQuery` requires authentication.** The anonymous/public resolution path and the seed-tenant fallback were removed; the function 401s without a valid bearer token (`functions/index.js`, `functions/wiki-chunks.js`). The browser client now sends the Firebase ID token (`src/utils/rag-client.js`, `src/modules/wiki-enrichment.js`, `src/modules/jules-api.js`).
4. **Public bundle removed.** Deleted `wiki/_chunks.json`, `scripts/build-wiki-index.js`, `.github/workflows/wiki-index.yml`, and the `build:wiki-index` npm script, plus the `loadBundledChunks` fallback. `wiki/_index.json` is kept so the `/wiki` browse tree still renders (its generator is now gone, so it is a static snapshot).

**Supersedes in this document:** §3.4 (no anonymous or public-tenant resolution; authenticated callers query only tenants they are a member of), §3.10 (visibility is private-only; tenant membership is the sole access boundary), §5 "single seed tenant for anonymous callers" (removed), W1 "public tenant read path for anonymous users" and W6 "bundled-chunks fallback" (removed).

**Behavioral consequences (intended):** the dev-history wiki is now members-only, so prompt enrichment from it and the `search-dev-history` Claude Code skill only return results for members of an accessible tenant. Non-members get empty results (no error).

**Known limitation (pre-existing):** `functions/rag.js` filters out chunks whose `visibility === 'private'` when `includePrivate` is false, and `ragQuery` always passes false. Seed SDDs are frontmatter `visibility: public`, so they remain searchable, but a new SDD authored as `visibility: private` is not searchable even by authorized members. Tracked as a follow-up.

**Still open (not addressed by this pass):**
- **At-rest encryption.** Content is still plaintext in Firestore, so an operator with project or Cloud KMS access can read it. Full protection against platform-level access requires the separate encryption workstream (KMS envelope encryption, function-layer per-doc ACLs, per-account sharing). This reverses the §5 "Per-doc ACLs in v1? No" decision and the §7 out-of-scope stance; per-account sharing and per-doc encryption become the next milestone.
- **Contractual.** Using PromptRoot for a third party's proprietary IP still requires a DPA and approved-vendor status, independent of code.

---

## 1. Objective

Move SDDs out of per-app git repos and into PromptRoot itself. Today the wiki shipped in PR #814 only knows about PromptRoot's own design history — every other app the user develops (planet, myplanet, future projects) would need its own `wiki/` folder, build script, GitHub Action, and Cloud Function deployment. This SDD turns PromptRoot into a multi-tenant SDD host: each app registers as a tenant, SDDs live in Firestore (edited via PromptRoot's UI), the existing `ragQuery` endpoint federates across tenants, and app repos drop their `wiki/` folders entirely. Prompts stay in git — different artifact, different storage model.

---

## 2. Current State

| Area | Today | Gap |
|------|-------|-----|
| SDD storage | `wiki/*.md` in PromptRoot repo only | No path for other apps to participate |
| SDD editing | git commit + PR review | No in-app editor; non-engineers locked out |
| SDD versioning | `git log` / `git blame` | Tied to repo lifecycle, not portable |
| Index build | `scripts/build-wiki-index.js` at CI time | Hardcoded to one repo's `wiki/` folder |
| `ragQuery` | BM25 over single hosted `_chunks.json` | Single-tenant; no `tenantId` concept |
| Agent discovery | `AGENTS.md` + skill point at one endpoint | Same endpoint regardless of which repo agent runs in |
| App repo footprint | `wiki/` folder + Action + frontmatter validator | Clutter every consumer repo carries |

---

## 3. Architecture

### 3.1 What flips

- **Source of truth for SDDs:** git → Firestore
- **Editor:** text editor + PR → in-app markdown editor with live preview
- **Versioning:** `git log` → `versions/` sub-collection with full snapshots
- **Index regeneration:** GitHub Action on push → Firestore trigger on save
- **Discovery:** one endpoint, one repo → one endpoint, `tenantId`-scoped queries
- **Prompts:** *unchanged* — still in git per `prompts/` directory, still browsed via GitHub API

### 3.2 Firestore data model

```
tenants/{tenantId}
  ├─ name: "Planet"
  ├─ slug: "planet"
  ├─ description: "Personal productivity app"
  ├─ ownerUid: "..."
  ├─ members: ["uid1", "uid2"]
  ├─ visibility: "private" | "public"
  ├─ githubRepo: "jessewashburn/planet"      # optional, for git mirror + auto-resolve
  ├─ createdAt, updatedAt
  └─ sdds/{slug}
       ├─ title, slug, status, owner, tags, related, visibility
       ├─ body: <markdown string, ≤1MB; spillover to Cloud Storage>
       ├─ bodyStoragePath: "gs://promptroot-sdds/{tid}/{slug}/current.md"  # if spilled
       ├─ headings: [{ level, text }]
       ├─ currentVersion: "01HXYZ..."
       ├─ lastModified, lastEditorUid
       └─ versions/{versionId}
            ├─ body: <full snapshot>
            ├─ bodyStoragePath: <if spilled>
            ├─ frontmatter: { ... }
            ├─ authorUid, authorName
            ├─ savedAt
            └─ changeNote: "Add discovery section"   # optional

userSessions/{sessionId}                  # CLI/MCP device-flow tokens
  ├─ uid: "..."                           # owner of the session
  ├─ deviceLabel: "Claude Code on macbook-pro"
  ├─ tokenHash: "<sha256 of bearer token>"
  ├─ createdAt, lastUsedAt
  └─ revokedAt: null | <timestamp>

deviceAuthRequests/{deviceCode}           # short-lived, TTL ~10 min
  ├─ userCode: "WDJB-MJHT"
  ├─ status: "pending" | "authorized" | "expired"
  ├─ uid: <set when user authorizes in browser>
  └─ expiresAt
```

### 3.3 Index pipeline

Existing pipeline becomes per-tenant:

```
Firestore write on tenants/{tid}/sdds/{slug}
   │
   ▼
Firestore trigger: rebuildTenantIndex(tid)
   │
   ▼
Read all sdds/* under tenant
   │
   ▼
Run chunkDoc() + extractHeadings() (existing scripts/lib/)
   │
   ▼
Write Cloud Storage:
  gs://promptroot-sdds/{tid}/_chunks.json
  gs://promptroot-sdds/{tid}/_index.json
   │
   ▼
Invalidate ragQuery in-memory cache for {tid}
```

The chunker, tokenizer, and BM25 logic carry over unchanged from PR #814. Only the source (Firestore) and destination (Cloud Storage per tenant) change.

### 3.4 `ragQuery` v2

Backwards-compatible extension:

```ts
// v1 (today)
ragQuery({ query: string, topK?: number })

// v2
ragQuery({
  query: string,
  topK?: number,
  tenantId?: string,        // explicit single-tenant
  tenantIds?: string[],     // federated; results tagged with tenantId
})
```

Resolution order when neither is provided:
1. Caller authenticated → query all tenants the user is a member of, federated.
2. Caller anonymous → query only `visibility: "public"` tenants.

5-minute in-memory cache stays, keyed on `(tenantId, query)`.

### 3.5 In-app SDD editor

New page: `pages/wiki-edit/wiki-edit.html` + `src/pages/wiki-edit-page.js`.

Layout:
- Left rail: tenant tree (existing `wiki-index.js` extended for tenant scoping)
- Center: markdown editor textarea with split-pane preview (reuse `prompt-renderer.js` for rendering)
- Right rail: frontmatter form (status dropdown, tags chips, related-doc multi-select, visibility toggle, change note)
- Footer: Save (writes new version), Cancel, View History

Non-engineers can register, write, and ship an SDD without leaving the browser. Engineers who prefer git get the optional mirror (§3.8).

### 3.6 Version history UI

New view: `pages/wiki-history/wiki-history.html`.

- Timeline list: `2026-04-26 11:32 — Jesse — "Add discovery section"`
- Click a row → full-pane render of that version
- Compare mode: pick two rows, side-by-side diff (use `diff-match-patch`, ~10KB lazy-loaded like Fuse.js is today)
- Restore button on any version: writes the old body as a new version; never destructive

### 3.7 Tenant registration

New page: `pages/tenants/tenants.html`.

- List user's owned and joined tenants
- "New tenant" form: name, slug, description, visibility, optional GitHub repo
- "Invite member" by GitHub handle (resolves to UID via existing auth)
- "Transfer ownership" with confirm modal
- "Delete tenant" — soft delete (tombstone field), 30-day recovery window before hard delete via scheduled Cloud Function

### 3.8 Optional git mirror

Per-tenant setting: "Mirror to GitHub repo on save."

When enabled:
- On version write, a Cloud Function commits the markdown to `githubRepo` at `wiki/{slug}.md` via the GitHub API
- Commit message: `wiki: {slug} — {changeNote || 'edit'}`
- Author = the editor's GitHub identity (Firebase auth surfaces this)
- Failure to mirror does *not* block the Firestore save — mirror status surfaces in the editor as a non-blocking toast

The user keeps Firestore as the live editor + version log; gets a `git log` and PR-reviewable mirror for free; can walk away from PromptRoot and still own their SDDs.

### 3.9 Agent discovery

Three tenant-resolution paths, in order:

1. **Explicit:** caller passes `tenantId` directly. Skill, LM Tool, and Jules enrichment all support this.
2. **Workspace marker:** repo root contains `.promptroot-tenant` (single line: the tenant slug). The skill and VS Code extension read it on activation.
3. **Git remote heuristic:** read `git remote get-url origin`, look up `tenants` where `githubRepo` matches. Falls back gracefully if no match.

`AGENTS.md` template documents all three. Updates to the existing skill (`.claude/skills/search-dev-history/`) and the VS Code SDD (`vscode-wiki-integration`) accept the `tenantId` parameter.

### 3.10 Auth and visibility

- **Tenant-level visibility:** public tenants are queryable by anyone; private tenants only by `members[]`. Enforced in Firestore rules and in `ragQuery`.
- **Per-doc visibility:** within a tenant, individual SDDs can still be marked `visibility: private`. Existing `wiki/private/` convention maps to a frontmatter field, no longer a folder.
- **Editor permissions:** tenant `members[]` can edit any SDD in their tenant. No per-doc ACLs in v1.

### 3.11 Write path — Cloud Function API + MCP server + GitHub OAuth device flow

The browser editor (§3.5) is one consumer of the write API. The other is the agent flow: a developer in VS Code asks Claude Code "create an SDD for X" while working in their app's repo. Both paths converge on the same Cloud Function endpoints.

#### 3.11.1 Cloud Function HTTP API

```
POST /createSdd       { tenantId, slug, frontmatter, body, changeNote? }
POST /updateSdd       { tenantId, slug, body, frontmatter?, changeNote? }
POST /listSdds        { tenantId }
POST /getSdd          { tenantId, slug, version? }
POST /searchSdds      { tenantId | tenantIds, query, topK? }   # = ragQuery v2
POST /listVersions    { tenantId, slug }
POST /restoreVersion  { tenantId, slug, versionId }
```

All endpoints take `Authorization: Bearer <session-token>`. The function resolves the token → UID → tenant membership before executing. Browser editor calls these via the Firebase SDK (gets the bearer token from Firebase Auth automatically); the MCP server calls them via plain HTTPS with a session token from the device flow.

#### 3.11.2 GitHub OAuth device flow (CLI auth path)

Same GitHub OAuth identity as the web app — no PATs, no separate credentials. Just a CLI handoff so the agent can act as the user.

```
User runs: claude mcp add promptroot
   │
   ▼
MCP server calls POST /startDeviceAuth
   │ returns { deviceCode, userCode, verificationUrl, interval }
   ▼
MCP server prints:
  "Visit https://promptroot.ai/auth/device and enter code: WDJB-MJHT"
   │
   ▼
User opens browser:
  - Already signed into PromptRoot, OR signs in via GitHub OAuth (existing flow)
  - Enters userCode, clicks Authorize on /pages/auth-device/auth-device.html
   │
   ▼
Browser calls POST /authorizeDevice { userCode }
  - Looks up the pending device-auth session
  - Mints a long-lived session token tied to the user's UID
  - Stores in userSessions/{sessionId} with { uid, deviceLabel, createdAt, lastUsedAt }
   │
   ▼
MCP server (polling POST /pollDeviceAuth { deviceCode }) gets the token
  - Stores it in ~/.config/promptroot/credentials (chmod 600)
  - Subsequent tool calls include it as a bearer token
```

New collection: `userSessions/{sessionId}` (revocable, listed in profile UI).

#### 3.11.3 The PromptRoot MCP server

A small npm package (`@promptroot/mcp-server`) the user installs once per machine via `claude mcp add promptroot`. Exposes the Cloud Function API as MCP tools so any MCP-speaking agent (Claude Code, Cursor, Continue, Cline, etc.) gets the tools auto-registered without per-agent integration.

Tool surface (each maps 1:1 to a Cloud Function endpoint):

| Tool | Description |
|------|-------------|
| `promptroot_create_sdd` | Create a new SDD in a tenant. Body, frontmatter, optional change note. |
| `promptroot_update_sdd` | Update an existing SDD; writes a new version. |
| `promptroot_list_sdds` | List SDDs in a tenant (slug, title, status, last modified). |
| `promptroot_get_sdd` | Fetch a specific SDD body, optionally pinned to a version. |
| `promptroot_search_sdds` | BM25 search; replaces the standalone skill once installed. |
| `promptroot_list_versions` | List versions of an SDD. |
| `promptroot_restore_version` | Roll back to an earlier version (writes a new version, non-destructive). |

The MCP server auto-resolves `tenantId` for the agent when not supplied:
1. Read `.promptroot-tenant` from the workspace root
2. Read `git remote get-url origin`, look up `tenants` where `githubRepo` matches
3. If neither resolves, error with a hint to run `npx promptroot-tenant-init`

Why MCP and not raw HTTP / a CLI / a skill:

| Approach | Auto-discovery | Typed schemas | Auth boundary | Cross-agent |
|----------|---------------|---------------|---------------|-------------|
| Raw HTTP from agent | No (must teach via CLAUDE.md) | No | Token in conversation/env | Per-agent setup |
| CLI tool | No (parse `--help`) | No | OK | Per-agent shell-out |
| Skill (markdown) | Partial (Claude Code only) | No | No credentials | Claude-Code only |
| **MCP server** | **Yes** | **Yes** | **Token in MCP config, never in model context** | **Any MCP-speaking agent** |

#### 3.11.4 The agent flow, end to end

User in VS Code working on `~/code/myplanet`:

```
You:    "Create an SDD for the new notification system"

Claude Code (the agent):
  1. Reads .promptroot-tenant → resolves tenantId = "myplanet"
  2. Calls promptroot_search_sdds({ tenantId, query: "notification" })
        → MCP server → Cloud Function /searchSdds → BM25 → results
        → returns: no prior art on notifications
  3. Drafts SDD content using _template.md shape
  4. Calls promptroot_create_sdd({
        tenantId: "myplanet",
        slug: "notifications",
        frontmatter: { ... },
        body: "# SDD: Notifications\n..."
     })
        → MCP server → Cloud Function /createSdd
        → Firestore writes tenants/myplanet/sdds/notifications + versions/v1
        → returns { url: "https://promptroot.ai/wiki/myplanet/notifications" }
  5. Replies: "Created [myplanet/notifications](url). Want me to open the
              browser editor to refine the frontmatter?"
```

No file ever lands in the myplanet repo. No git involvement (unless §3.8 mirror is on). The SDD lives in PromptRoot from t=0.

#### 3.11.5 Token revocation

- `pages/profile/` adds an "Active sessions" section listing each `userSessions` doc with device label, last used, and a Revoke button.
- Signing out of PromptRoot kills *all* the user's sessions.
- Revoking GitHub's OAuth grant breaks Firebase Auth → all sessions die.

### 3.12 What stays the same

- BM25 retrieval (no embeddings, no API keys for retrieval)
- Chunker, tokenizer, frontmatter parser (`scripts/lib/`)
- 5-min in-memory cache pattern in `ragQuery`
- AGENTS.md convention
- The standalone Claude Code skill keeps working for users who don't install the MCP server (read-only, public tenants only)

---

## 4. Workstreams

### W1 — Firestore schema and rules ✅ Complete (PR #814)

- [x] `config/firestore/firestore.rules` entries for `tenants/`, `tenants/{tid}/sdds/`, `tenants/{tid}/sdds/{slug}/versions/`
- [x] Rules for `userSessions/{sessionId}` (read/revoke by owner only) and `deviceAuthRequests/{deviceCode}` (server-only writes)
- [x] Tenant member checks (`request.auth.uid in resource.data.members`)
- [x] Public tenant read path for anonymous users (only when `visibility == "public"`)
- [x] Indexes for tenant lookup by `ownerUid`, `slug`, `githubRepo` (6 composite indexes)
- [x] Migration script: import existing `wiki/*.md` files as the seed tenant `promptroot`

### W2 — Tenant CRUD UI ⚠ Partial (PR #814) — create + list only

**Shipped:**
- [x] `pages/tenants/tenants.html` + `src/pages/tenants-page.js` (210 lines)
- [x] `src/modules/wiki-api.js` client (CRUD via Cloud Functions)
- [x] List user's owned/joined tenants with name, slug, visibility pill, member count, description, GitHub mirror
- [x] "Create new tenant" form: slug, name, description, visibility, optional GitHub repo (with kebab-case + length validation, JS-driven error messages via `tenantsCreateStatus`)
- [x] Per-tenant "View SDDs" link to `/wiki?tenant=...`
- [x] "Refresh" button
- [x] Standard `.form-control`, `.btn sm`, `.page-header` + `.toolbar-actions` patterns; `novalidate` form with custom validation (matches the style guide)

**Deferred (API absent or UI absent):**
- [ ] **Invite member by GitHub handle** — no API, no UI. `members[]` is currently set to `[ownerUid]` at create time and never modified.
- [ ] **Transfer ownership** — no API, no UI.
- [ ] **Delete tenant (soft-delete with 30-day recovery)** — no API, no UI, no tombstone field, no scheduled hard-delete Cloud Function.
- [ ] **Edit existing tenant settings** (rename, change visibility, attach/detach GitHub repo, toggle mirror) — no API, no UI.
- [ ] **Per-tenant "Mirror to GitHub" toggle** — depends on W7.

These are required before a multi-user tenant is actually usable; v1 only supports the single-owner case.

### W3 — In-app SDD editor ✅ Complete (PR #814)

- [x] `pages/wiki-edit/wiki-edit.html` + `src/pages/wiki-edit-page.js` (~400 lines)
- [x] Frontmatter form: title, slug (immutable after create), date, status dropdown, owner, tags (comma-separated), related slugs (comma-separated), visibility, change note
- [x] Markdown body textarea with Edit/Preview tab toggle (preview reuses `marked.js` + `DOMPurify`)
- [x] Auto-save draft to localStorage on input/change events; explicit Save creates the persisted version via `createSdd`/`updateSdd`
- [x] Load existing SDD via `?tenant=X&slug=Y` URL params; new SDD via `?tenant=X` only
- [x] Cancel button navigates back to `/wiki?tenant=...&doc=...` (with discard-draft confirm if unsaved)
- [x] JS-side validation (title, slug regex, date, owner all required) with styled error display
- [x] Markdown editor styling in `src/styles/pages/wiki-edit.css`

**Deferred:**
- [ ] **Side-by-side split-pane preview** — original §3.5 called for live three-pane layout; v1 uses tabbed Edit/Preview which is functionally equivalent but visually less rich.
- [ ] **Tag chips, related-doc multi-select** — original §3.5 called for proper component widgets; v1 uses comma-separated text inputs which work but are less polished.

### W4 — Version history UI ✅ Complete (PR #814)

- [x] `pages/wiki-history/wiki-history.html` + `src/pages/wiki-history-page.js`
- [x] Timeline list pane (left): version timestamp, author display name, change note
- [x] Detail pane (right): full markdown render of selected version (reuses `marked.js` + `DOMPurify`)
- [x] "Restore this version" button: writes the old body as a new version via `restoreVersion` (non-destructive — the old version row stays)
- [x] "← Back to Wiki" link in standard `.page-header` pattern

**Deferred:**
- [ ] **Side-by-side diff between two versions** — original §3.6 called for compare mode using `diff-match-patch` (~10KB lazy-loaded); v1 only does single-version view. Diff view tracked as follow-up.

### W5 — Index pipeline (Firestore-driven) ❌ Deferred to follow-up

**Not built. v1 substitutes a simpler in-memory pipeline:**

- v1 (shipped): `functions/wiki-chunks.js` lazy-loads all SDDs from Firestore into a per-tenant in-memory chunk cache on first `ragQuery` call, refreshes every 5 minutes (TTL). Trade-off: cold cache after each function instance restart, ~hundreds-of-ms first-query latency for tenants with many SDDs.
- v2 (deferred): Firestore trigger `onSddWrite(tenants/{tid}/sdds/{slug})` → write `gs://promptroot-sdds/{tid}/_chunks.json` and `_index.json` → invalidate ragQuery cache. Eliminates cold-cache latency, makes index queryable by other services.

**Deferred items:**
- [ ] Cloud Function `onSddWrite` Firestore trigger
- [ ] Cloud Storage bucket `promptroot-sdds` provisioning + lifecycle rules
- [ ] Storage rules: tenant-scoped read for members; public read only for public tenants
- [ ] `wiki-chunks.js` updated to fetch from Cloud Storage instead of Firestore
- [ ] Debounce: cap rebuild at 1× per tenant per 30s to avoid runaway writes from rapid edits

**Estimated effort:** 1-2 days. Not blocking v1 launch since in-memory cache is correct, just less performant.

### W6 — `ragQuery` v2 ✅ Complete (PR #814)

- [x] Added `tenantId` (single) and `tenantIds` (multi) parameters; default resolution rules per §3.4
- [x] Per-tenant in-memory cache (5-min TTL) keyed on tenant id
- [x] Auth check for private tenants — `tenantIsAccessible(tenantId, uid)` verifies caller is in `members[]` or that the tenant is public
- [x] Federated query: ranks across all accessible tenants, returns each result tagged with its `tenantId`
- [x] Backwards compatibility: no `tenantId` from anonymous callers falls back to the seed `promptroot` tenant (or queries all `visibility: public` tenants when authenticated without a specific tenant)
- [x] Bundled-chunks fallback: when the seed tenant doesn't exist in Firestore yet, `loadBundledChunks()` fetches `https://promptroot.ai/wiki/_chunks.json` so the public wiki survives an empty Firestore (used during pre-migration period)
- [x] BM25 scoring with heading boost (1.5×) and tag boost (1.25×) preserved from v1
- [x] Cloud Function `functions/wiki-chunks.js` (119 lines): dedicated tenant chunk loader and accessibility checks
- [x] Cloud Function `functions/rag.js` (75 lines): BM25 scorer extracted from the v1 `index.js` glob

### W7 — Optional git mirror ❌ Deferred to follow-up

**Not built. The `tenants/{tid}.githubRepo` field exists and is editable at create time, and the v1 schema already has a `mirrorEnabled: false` field per tenant, but no code reads it.**

**Deferred items:**
- [ ] Per-tenant settings UI to toggle `mirrorEnabled`, change `githubRepo`, choose a target branch
- [ ] Cloud Function `mirrorSddToGithub` triggered on `onSddWrite`
- [ ] GitHub OAuth scope upgrade: current `read:user` is read-only; mirror requires `repo` (private) or `public_repo` (public-only) scope
- [ ] User re-consent flow: existing users would need to re-authorize to grant the elevated scope
- [ ] Failure surface: non-blocking toast in editor when mirror fails (Firestore write still succeeds)
- [ ] Commit message format: `wiki: {slug} — {changeNote || 'edit'}`, author = editor's GitHub identity

**Why deferred:** the OAuth scope upgrade is user-visible and needs a separate rollout (existing sessions break until re-consent). Tracking separately keeps PR #814 free of auth-flow churn.

**Estimated effort:** 2-3 days including scope migration.

### W8 — Agent discovery updates ✅ Complete (PR #814)

- [x] `.claude/skills/search-dev-history/SKILL.md` updated to document MCP tool availability and tenant resolution; preserves read-only HTTP fallback for non-MCP agents
- [x] `AGENTS.md` complete rewrite: tenant resolution order (explicit → `.promptroot-tenant` file → git remote → error), MCP preferred path, Claude Code skill fallback, raw HTTP fallback with curl example
- [x] CLI helper `mcp-server/bin/promptroot-tenant-init.js` (97 lines): interactive tenant picker, writes `.promptroot-tenant` marker, generates `AGENTS.md` template tailored to the chosen tenant
- [x] `CLAUDE.md` "Dev history wiki" section updated with new pages, all 13 Cloud Function endpoints, and agent integrations
- [x] `mcp-server/README.md`: install, auth, tenant resolution, tool list, env var config (`PROMPTROOT_API_BASE`, `PROMPTROOT_DEVICE_FLOW_VERIFICATION_URL`, `PROMPTROOT_CREDENTIALS_PATH`)

### W12 — Cloud Function write API + MCP server + device flow auth ✅ Complete (PR #814)

**Cloud Function HTTP API (`functions/wiki.js`, 465 lines):**
- [x] SDD CRUD: `createSdd`, `updateSdd`, `listSdds`, `getSdd`, `listVersions`, `restoreVersion`
- [x] Tenant CRUD (create + list only): `createTenant`, `listTenants`
- [x] Manual CORS via `setCors()` + `ALLOWED_ORIGINS` allowlist (functions are configured `cors: false` to bypass the SDK's CORS handling so we can do auth-aware origin checks)
- [x] All write paths use Firestore batches for atomic doc + version writes
- [x] Generates `versionId` from base36 timestamp + 8 random chars (sortable + unique)

**Device-flow auth (`functions/wiki-device-flow.js`, ~280 lines):**
- [x] `startDeviceAuth`: returns `{ deviceCode, userCode, verificationUrl, expiresIn, interval }` and writes a `deviceAuthRequests/{deviceCode}` doc with 10-min TTL
- [x] `pollDeviceAuth`: returns `{ status: 'authorized', sessionToken }` once user authorizes; explicit error on unexpected status (post-review fix — was previously silent fallthrough)
- [x] `authorizeDevice`: browser-side endpoint that consumes the `userCode`, mints a session token, writes `userSessions/{sessionId}`
- [x] `listSessions` / `revokeSession`: API endpoints exist, no UI consumer yet (see deferred below)
- [x] `USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` (excludes ambiguous `I`, `O`, `0`, `1`); client regex matches (post-review fix)
- [x] Session tokens: `prs_`-prefixed, SHA-256 hashed before storage, 64-char random tail

**Auth resolution (`functions/wiki-auth.js`):**
- [x] `resolveBearer(authorization)`: routes `prs_`-prefixed tokens through `userSessions/` lookup, all other tokens through `admin.auth().verifyIdToken()`
- [x] `requireMembership(uid, tenantId)`: throws if user is not in `members[]`
- [x] `tenantIsReadable(uid, tenantId)`: returns `{ ok, reason, tenant }` for visibility-aware reads

**Browser device-flow confirmation page:**
- [x] `pages/auth-device/auth-device.html` + `src/pages/auth-device-page.js`
- [x] Auto-fill `userCode` from `?code=` query param
- [x] Hyphen auto-insert as user types
- [x] Strict regex match against `USER_CODE_ALPHABET` (post-review fix; was previously `[A-Z0-9]` which let users type ambiguous chars and get a confusing server reject)

**MCP server (`mcp-server/`):**
- [x] `@promptroot/mcp-server` npm package, 7 modules in `src/`:
  - `config.js` (env var resolution: API base, device-flow URL, credentials path)
  - `credentials.js` (read/write `~/.config/promptroot/credentials.json` Unix or `%APPDATA%\promptroot\credentials.json` Windows; chmod 600 on Unix)
  - `api.js` (HTTP POST wrapper, session-token bearer header, structured `ApiError` for upstream)
  - `device-flow.js` (`loginViaDeviceFlow` orchestrates start → print code → poll until authorized)
  - `tenant-resolver.js` (`.promptroot-tenant` marker → `parseGithubRepoFromRemote()` → API match)
  - `tools.js` (7 MCP tool definitions with JSON Schema input validation)
  - `server.js` (MCP stdio server)
- [x] 3 executables in `bin/`:
  - `promptroot-mcp-server.js` (entry for `claude mcp add`)
  - `promptroot-mcp-login.js` (interactive `claude mcp login` CLI)
  - `promptroot-tenant-init.js` (interactive picker, writes `.promptroot-tenant` and `AGENTS.md`)
- [x] 36 unit tests across 5 test files using Node.js built-in test runner
- [x] `package.json` declares `bin` entries, `@modelcontextprotocol/sdk` dependency, `node --test` script

**Critical post-review fix — Firebase deploy scope:**
- [x] `wiki.js`, `wiki-chunks.js`, and `rag.js` originally required from `../scripts/lib/` which is outside the `functions/` source dir that Firebase uploads. Cold-start would have failed with module-not-found.
- [x] Fix: copied `chunker.cjs`, `sdd-validate.cjs`, `tokenizer.cjs` into `functions/lib/` and updated all require paths.

**Deferred from W12:**
- [ ] **"Active sessions" panel in `/pages/profile/`** — §3.11.5 called for a profile UI listing each session with device label, last used, and Revoke button. API endpoints (`listSessions`, `revokeSession`) ship; UI does not.
- [ ] **`updateSdd` does not check `mergedFrontmatter` against the original validator on partial updates** — adequate for v1 since the merger preserves required fields, but a strict update validator (require fields present in the merged output) would harden against future changes.

### W9 — Migration of seed tenant ✅ Complete (PR #814)

- [x] Migration script `functions/migrate-wiki-to-tenant.js` (~190 lines): idempotent import of `wiki/*.md` → `tenants/promptroot/sdds/`
- [x] Parses YAML frontmatter via existing `scripts/lib/sdd-validate.cjs`
- [x] Writes the doc + an initial `versions/{generatedId}` snapshot (so the migrated SDDs have a real version row, not just current state)
- [x] Idempotent: re-running skips docs that already exist with matching `currentVersion`
- [x] Usage: `npm run migrate:wiki` or `node functions/migrate-wiki-to-tenant.js [--tenant=promptroot] [--dry-run]`
- [x] Added `migrate:wiki` script to `functions/package.json`

**Pending production action (post-deploy):**
- [ ] Run the migration against production Firestore once
- [ ] Verify parity: every SDD in `wiki/*.md` has a corresponding doc under `tenants/promptroot/sdds/`
- [ ] After verification, decide whether to delete the legacy `wiki/*.md` files or keep them as a forwarding shim (open question §6 #2)

### W10 — Testing ✅ Complete (PR #814)

**Shipped (1208 unit tests passing across 75 test files, 1 skipped):**
- [x] 36 MCP server module tests across 5 test files using Node.js built-in `node:test` runner:
  - `config.test.js` — env var resolution
  - `credentials.test.js` — read/write/clear with temp dir cleanup
  - `api.test.js` — fetch mocking, ApiError, missing-auth handling
  - `tenant-resolver.test.js` — git remote parsing, explicit slug, nonexistent cwd
  - `tools.test.js` — exactly 7 tool definitions, schemas, kebab-case slug regex
- [x] 12 SDD validation tests covering both frontmatter and tenant schemas
- [x] 3 cloud-function-url tests (production vs emulator routing detection)
- [x] 11 wiki-api client tests (bearer auth header, error handling, endpoint routing)
- [x] E2E smoke tests passing (wiki page render, tenant visibility, search)
- [x] CodeQL javascript-typescript analysis passing
- [x] qlty code quality passing (2 pre-existing vulnerabilities in unrelated code, not introduced by this PR)

**Deferred:**
- [ ] **Firestore security rules unit tests** — the `@firebase/rules-unit-testing` harness is not wired up. Rules are correct by inspection but not regression-protected against future edits.
- [ ] **Cloud Function integration tests** — `functions/test/index.test.js` exists but fails on Windows due to `NODE_ENV=test node --test` shell syntax (pre-existing, unrelated to this PR). Tests run in CI on Linux.
- [ ] **End-to-end MCP server test against a real Cloud Function** — the MCP unit tests mock the HTTP layer; a true integration test that boots the function emulator and runs a tool call is deferred.

### W11 — Docs and rollout ✅ Complete (PR #814)

- [x] `CLAUDE.md` "Dev history wiki" section updated with all new pages, all 13 Cloud Function endpoints, and the agent integration paths (project-scoped Claude Code skill + MCP server)
- [x] `AGENTS.md` rewritten for multi-tenant: tenant resolution order, MCP preferred path, Claude Code skill fallback, raw HTTP fallback
- [x] `mcp-server/README.md`: install, auth, tenant resolution, full tool list, env var config
- [x] This SDD (`wiki/multi-tenant-sdd-platform.md`) updated to reflect actual delivery
- [x] PR #814 description rewritten as a high-level "what does this accomplish" summary, with screenshot placeholders and a production test plan

**Deferred:**
- [ ] **`@promptroot/mcp-server` published to npm** — package.json is finalized, tests pass, but `npm publish` has not been run. Tracked as a post-deploy step.
- [ ] **Public announcement / changelog entry** — no `CHANGELOG.md` in the repo today; if we add one, this PR is the natural starting point.
- [ ] **Feature-flag rollout** — original W11 mentioned a feature flag; on review the API surface is independent of the existing Home/Queue/Jules pages, so a flag is not needed. Direct GA on merge + deploy.

### W13 — Post-review hardening ✅ Complete (PR #814)

Findings discovered during in-branch review and addressed before merge:

**Deploy-blocking:**
- [x] **`functions/lib/` shared CJS files.** `wiki.js`, `wiki-chunks.js`, and `rag.js` originally required from `../scripts/lib/` which is outside the Firebase Functions upload scope. Cold-start in production would have thrown module-not-found. Fix: copied `chunker.cjs`, `sdd-validate.cjs`, `tokenizer.cjs` into `functions/lib/` and updated all require paths. Confirmed all 25 functions load cleanly in the Functions emulator after the fix.

**Logic bugs:**
- [x] **`auth-device-page.js` user-code regex.** Client validation was `/^[A-Z0-9]{4}-[A-Z0-9]{4}$/` which accepts `I`, `O`, `0`, `1` — characters the server's `USER_CODE_ALPHABET` deliberately excludes. Real users typing those would get a confusing "Invalid or already-used code" rejection. Fix: tightened to `/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/`; updated input sanitizer to strip those characters as the user types.
- [x] **`pollDeviceAuth` silent status fallthrough.** Any non-`authorized` status (including malformed/corrupted documents) was returning `pending` indefinitely, leaving CLIs polling forever. Fix: explicit unknown-status path now logs and returns 500 so the CLI surfaces a real error.

**CodeQL findings:**
- [x] **Duplicate property `slug` in `mergedFrontmatter`** (`functions/wiki.js`, `updateSdd` handler) — first `slug: prev.slug` was shadowed by the spread then re-set. Removed the redundant first occurrence; kept the trailing one which is load-bearing (prevents client-supplied `frontmatter.slug` from renaming the doc).
- [x] **Unused `chunkDoc` import** (`functions/wiki.js`) — leftover from earlier iteration; chunking actually happens in `wiki-chunks.js`. Removed.

**UI / style-guide consistency pass:**
- [x] **`btn small` → `btn sm` everywhere.** The wiki PR pages used `class="btn small"` but only `.btn.sm` exists in `buttons.css`. The "small" modifier was a no-op, so all toolbar/action buttons rendered at default size. Fixed in `wiki.html`, `wiki-edit.html`, `wiki-history.html`, `tenants.html`, and `tenants-page.js`.
- [x] **`class="input"` → `class="form-control"`.** The PR pages used a custom `.input` class with no `appearance: none` rule, so `<select>` elements rendered with the OS-default dropdown arrow. Switched to the standard `.form-control` (modals.css) which has `appearance: none`, the SVG chevron, focus/disabled states. Updated `.wiki-edit-frontmatter` page-specific override to keep the compact look while inheriting standard styling.
- [x] **Native HTML5 validation replaced with styled UI** on the tenants form: `novalidate` attribute, dead `required`/`pattern` attributes removed, JS-driven error display via the existing `.tenants-status` panel. Added explicit empty-slug and length-bounds checks with clearer messages.
- [x] **Toolbar actions standardized** — replaced the ad-hoc `.wiki-toolbar-actions` shim with the existing `.toolbar-actions` component class. Added "New SDD" and "Tenants" actions to the `/wiki` toolbar so users can reach tenant management without typing the URL.
- [x] **Navigation symmetry** — `/wiki/tenants` adopted the standard `.page-header` + `.toolbar-actions` pattern with a "← Back to Wiki" link, matching `/wiki/history`'s Back affordance. The wiki-history Back link gained an `arrow_back` icon for consistency.

---

## 5. Resolved Decisions

| Question | Decision |
|----------|----------|
| Storage: Firestore docs or Cloud Storage blobs? | Firestore docs primarily (≤1MB markdown). Spill to Cloud Storage when bodies exceed the limit. Avoids the lookup hop for the 99% case. |
| Versioning: snapshots or diffs? | Full snapshots in `versions/{versionId}`. Markdown is small; even 100 versions ≈ 100KB. Diff-based storage adds complexity for marginal savings. |
| Do prompts also move to Firestore? | No. Prompts are reuse-oriented and forking is the core sharing mechanism. SDDs are history-oriented and don't fork. Different storage models for different artifacts. |
| Single-tenant or federated by default? | Federated when caller is authenticated (search across all your apps). Single seed tenant for anonymous callers (preserves the public PromptRoot wiki). |
| Do we keep BM25 or move to embeddings? | Keep BM25. No new dependency, no API key, no per-tenant indexing cost beyond what we already pay. Revisit only if a real precision gap shows up. |
| Per-doc ACLs in v1? | No. Tenant membership is the only access boundary. Per-doc ACLs add a permission matrix that hasn't been requested yet. |
| Agent integration: MCP, raw HTTP, CLI, or skill? | MCP server. Only option that gives auto-discovery, typed schemas, an auth boundary outside the model's context, and cross-agent portability (Claude Code, Cursor, Continue, Cline) without per-agent integration. |
| CLI auth: PAT or GitHub OAuth device flow? | Device flow. Same GitHub OAuth identity as the web app — no separate credential to manage or revoke. Sessions tied to the user's actual auth; revoking GitHub access kills every CLI session. |

---

## 6. Open Questions

1. **Tenant slug uniqueness.** Globally unique (planet-001 if planet is taken) or per-owner (user A's `planet` ≠ user B's `planet`)? Globally unique is simpler for URL routing (`/wiki/planet/...`); per-owner is friendlier. Lean global with a "rename available" hint.
2. **Migration cutoff for legacy wiki.** Do we keep `wiki/*.md` in this repo as a forwarding shim indefinitely, or delete it after migration? Forwarding stubs add maintenance; deleting may break external links if anyone outside this repo references them. Audit links before deciding.
3. **Search across tenants the user *owns* vs. *all public*.** Federated default could mean "only my tenants" or "my tenants + all public." Public-by-default risks noisy results for niche queries. Lean members-only by default with an opt-in `includePublic: true`.
4. **Cloud Storage cost ceiling.** Per-tenant `_chunks.json` regeneration on every save is fine at our scale, but a tenant with 1000 SDDs editing constantly could rack up Storage writes. Cap at one rebuild per tenant per 30s (debounce in the trigger) if it becomes an issue.
5. **Prompts in this same UI?** Out of scope for this SDD. Worth a follow-up: should the SDD editor be a generalized "markdown content for tenant X" surface that prompts could ride on top of? Likely yes, but not in v1.

---

## 7. Out of Scope (v1)

- Embedding-based retrieval. BM25 stays.
- Per-doc ACLs. Tenant membership is the only boundary.
- Real-time collaborative editing (Google-Docs-style). Single editor at a time; later-save wins; auto-save draft prevents data loss.
- Comments/threads on SDDs. SDDs are decisions, not discussions; comments belong in PRs (mirror) or external chat.
- Public marketplace of tenants. Tenants exist; discovery is by direct link or membership invite. No "browse all public wikis" page yet.
- Prompts migration. Prompts stay in git per §3.1.
- Web (vscode.dev) parity. Web is fine for the editor (it's just PromptRoot), but extension integration tracked in `vscode-wiki-integration` stays desktop-first.
- Bulk import from arbitrary git repos. v1 imports the seed `promptroot` tenant. Generic git-import tool deferred.

---

## 8. Milestones

| Milestone | Workstreams | Status | PR |
|-----------|-------------|--------|-----|
| M1: Schema, rules, tenant CRUD | W1, W2 | ⚠ Partial — W2 create+list only, no edit/invite/transfer/delete | #814 |
| M2: SDD editor + version history | W3, W4 | ✅ Complete (no diff view in W4) | #814 |
| M3: Index pipeline + `ragQuery` v2 | W5, W6 | ⚠ Partial — W6 complete; W5 (Firestore-trigger Cloud Storage index) deferred | #814 |
| M4: Write API + MCP server + device flow auth | W12 | ✅ Complete (`/profile/` sessions UI deferred) | #814 |
| M5: Git mirror | W7 | ❌ Deferred — needs OAuth scope upgrade | — |
| M6: Agent discovery + skill updates | W8 | ✅ Complete | #814 |
| M7: Seed migration + parity verification | W9 | ✅ Script ready; production run pending post-deploy | #814 |
| M8: Tests + docs + rollout | W10, W11 | ✅ Complete (npm publish pending) | #814 |
| M9: Post-review hardening | W13 | ✅ Complete | #814 |

**Status Summary**

PR #814 ships the complete v1 platform. The deferred items are bounded and separable:

| Workstream | Item | Why deferred | Effort |
|------------|------|--------------|--------|
| W2 | Tenant member management UI (invite, transfer, delete) | Single-owner case is functional; multi-user can ship independently | 1-2 days |
| W3 | Side-by-side editor + tag chips | Tabbed Edit/Preview ships; pure UX upgrade | 1 day |
| W4 | Side-by-side version diff | Single-version view ships; needs `diff-match-patch` integration | 0.5 day |
| W5 | Firestore-trigger Cloud Storage index pipeline | In-memory cache is correct, just less performant; pure perf upgrade | 1-2 days |
| W7 | Git mirror | Needs `repo` OAuth scope upgrade and user re-consent flow | 2-3 days |
| W12 | `/profile/` "Active sessions" panel | API ships; UI is non-blocking since revocation works at the bearer level | 0.5 day |
| W10 | Firestore rules unit tests | Rules correct by inspection; not regression-protected against future edits | 1 day |
| W11 | npm publish `@promptroot/mcp-server` | Manual operational step | 15 min |

Total deferred effort: **~7 days** spread across follow-up PRs that can land independently.

**Ready for production:**
- 13 Cloud Function endpoints (CRUD, search, device-flow, sessions)
- 5 web pages (`/wiki`, `/wiki/edit`, `/wiki/history`, `/wiki/tenants`, `/auth/device`)
- `@promptroot/mcp-server` package with 7 MCP tools and 3 CLI binaries
- 1208 unit tests passing (36 MCP, 12 SDD validation, 11 wiki-api, plus regression coverage)
- All review-discovered bugs fixed; CodeQL clean; deploy-blocking `functions/lib/` issue resolved
- No feature flag needed — direct GA on merge + deploy
