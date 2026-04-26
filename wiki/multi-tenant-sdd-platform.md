---
title: Multi-Tenant SDD Platform — PromptRoot as the Wiki Host
slug: multi-tenant-sdd-platform
date: 2026-04-26
status: proposal
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
**Status:** proposal

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

### W1 — Firestore schema and rules

- [ ] `config/firestore/firestore.rules` entries for `tenants/`, `tenants/{tid}/sdds/`, `tenants/{tid}/sdds/{slug}/versions/`
- [ ] Rules for `userSessions/{sessionId}` (read/revoke by owner only) and `deviceAuthRequests/{deviceCode}` (server-only writes)
- [ ] Tenant member checks (`request.auth.uid in resource.data.members`)
- [ ] Public tenant read path for anonymous users (only when `visibility == "public"`)
- [ ] Indexes for tenant lookup by `ownerUid`, `slug`, `githubRepo`
- [ ] Migration script: import existing `wiki/*.md` files as the seed tenant `promptroot`

### W2 — Tenant CRUD UI

- [ ] `pages/tenants/tenants.html` + `src/pages/tenants-page.js`
- [ ] `src/modules/tenant-service.js` (CRUD via Firestore SDK)
- [ ] Reuse `confirm-modal.js`, `dropdown.js`, existing form components
- [ ] Member invite flow (resolve GitHub handle → UID)
- [ ] Soft-delete with 30-day recovery

### W3 — In-app SDD editor

- [ ] `pages/wiki-edit/wiki-edit.html` + `src/pages/wiki-edit-page.js`
- [ ] `src/modules/sdd-editor.js` (textarea + live preview + frontmatter form)
- [ ] Frontmatter form components (status dropdown, tags chips, related multi-select, visibility toggle)
- [ ] Auto-save draft to localStorage every 10s; explicit Save creates the version
- [ ] Cmd/Ctrl+S keyboard shortcut for save
- [ ] Markdown editor styling in `src/styles/pages/wiki-edit.css`

### W4 — Version history UI

- [ ] `pages/wiki-history/wiki-history.html` + `src/pages/wiki-history-page.js`
- [ ] `src/modules/sdd-versions.js` (list, fetch, diff, restore)
- [ ] Lazy-load `diff-match-patch` via existing `lazy-loaders.js` pattern
- [ ] Side-by-side and inline diff modes
- [ ] Restore action with confirm modal

### W5 — Index pipeline (Firestore-driven)

- [ ] Cloud Function `onSddWrite` (Firestore trigger) → rebuild tenant index
- [ ] Cloud Function helper `rebuildTenantIndex(tid)` reused from manual triggers
- [ ] Write `_chunks.json` and `_index.json` per tenant to Cloud Storage
- [ ] Storage bucket: `promptroot-sdds`, structured `{tid}/_chunks.json`, `{tid}/_index.json`, `{tid}/{slug}/{versionId}.md` for spilled bodies
- [ ] Storage rules: tenant-scoped read for members; public read only for public tenants
- [ ] Retire `scripts/build-wiki-index.js` and the `.github/workflows/wiki-index.yml` action once seed tenant is migrated

### W6 — `ragQuery` v2

- [ ] Add `tenantId` and `tenantIds` parameters; default resolution rules per §3.4
- [ ] Read tenant chunks from Cloud Storage instead of the bundled URL
- [ ] Per-tenant in-memory cache (5-min TTL, same pattern)
- [ ] Auth check for private tenants — verify caller is in `members[]`
- [ ] Federated query: rank across tenants, tag each result with its `tenantId`
- [ ] Backwards compatibility: no `tenantId` from public callers continues to work, hits the seed `promptroot` tenant

### W7 — Optional git mirror

- [ ] Per-tenant setting in tenant CRUD UI: enable/disable + GitHub repo + branch
- [ ] Cloud Function `mirrorSddToGithub` invoked from `onSddWrite`
- [ ] Use the user's existing GitHub OAuth token (already used for prompt browsing)
- [ ] Mirror failure surfaces as a toast in the editor; does not block save
- [ ] Mirror status field on the SDD doc: `lastMirroredAt`, `mirrorStatus: ok | failed | disabled`

### W8 — Agent discovery updates

- [ ] Update `.claude/skills/search-dev-history/SKILL.md` to accept `tenantId`, document workspace-marker and git-remote resolution
- [ ] Update `AGENTS.md` template (publish a copy users can drop into their app repos)
- [ ] Update VS Code SDD (`vscode-wiki-integration.md`) to thread `tenantId` through palette, participant, LM Tool
- [ ] Add CLI helper: `npx promptroot-tenant-init` writes `.promptroot-tenant` and `AGENTS.md` to the current repo

### W12 — Cloud Function write API + MCP server + device flow auth

- [ ] Cloud Function endpoints: `createSdd`, `updateSdd`, `listSdds`, `getSdd`, `listVersions`, `restoreVersion` (per §3.11.1)
- [ ] Auth middleware: bearer token → UID → tenant membership check, shared across endpoints
- [ ] Device flow endpoints: `startDeviceAuth`, `pollDeviceAuth`, `authorizeDevice`
- [ ] Browser page `pages/auth-device/auth-device.html` for the user-facing code-entry step
- [ ] `userSessions/{sessionId}` Firestore collection with revocation rules; cleanup on sign-out
- [ ] "Active sessions" section in `pages/profile/` with revoke action
- [ ] `@promptroot/mcp-server` npm package exposing the API as MCP tools per §3.11.3
- [ ] MCP server resolves `tenantId` from `.promptroot-tenant`, then `git remote`, then errors
- [ ] MCP server stores credentials in `~/.config/promptroot/credentials` (chmod 600 on Unix; equivalent ACL on Windows)
- [ ] Install docs: `claude mcp add promptroot` one-liner + Cursor / Continue / Cline equivalents
- [ ] Integration test: spin up a fake MCP client, exercise the full create → search → update → restore loop against Firestore emulator

### W9 — Migration of seed tenant

- [ ] One-shot migration script: read existing `wiki/*.md`, write each as an SDD doc under `tenants/promptroot/sdds/{slug}` with version `v1` containing the full body
- [ ] Verify `ragQuery` returns the same top results pre- and post-migration for a fixture set of queries
- [ ] Delete `wiki/` folder, build script, and GitHub Action only after parity verified
- [ ] Forwarding stubs in `wiki/*.md` → "moved to PromptRoot" with deep links (optional; depends on whether anything outside this repo links to them)

### W10 — Testing

- [ ] Unit: tenant service, SDD editor, version diff, frontmatter form
- [ ] Unit: Firestore rules tests via `@firebase/rules-unit-testing` (covers tenant member gating, public visibility, version sub-collection access)
- [ ] Unit: `ragQuery` tenant resolution and federation
- [ ] E2E smoke: create tenant → write SDD → version history → restore older version → query via `ragQuery` returns the SDD
- [ ] E2E smoke: anonymous user querying private tenant gets empty results, not an error
- [ ] Parity test: same query against legacy bundled `_chunks.json` and migrated tenant returns identical top-5 ranking

### W11 — Docs and rollout

- [ ] User-facing guide in `docs/MULTI_TENANT_WIKI.md`: how to create a tenant, register agents, mirror to git
- [ ] Update `CLAUDE.md` (this repo's) to reflect the platform shift
- [ ] Update `dev-history-wiki.md` to point at this SDD as the v2 architecture
- [ ] Public landing page section on PromptRoot describing "Wiki for your apps"
- [ ] Beta-flag the editor pages behind a feature flag for first two weeks; promote to GA after dogfooding on `promptroot` tenant

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

| Milestone | Workstreams | Effort |
|-----------|-------------|--------|
| M1: Schema, rules, tenant CRUD | W1, W2 | 2 days |
| M2: SDD editor + version history | W3, W4 | 3 days |
| M3: Index pipeline + `ragQuery` v2 | W5, W6 | 2 days |
| M4: Write API + MCP server + device flow auth | W12 | 3 days |
| M5: Git mirror | W7 | 1 day |
| M6: Agent discovery + skill updates | W8 | 1 day |
| M7: Seed migration + parity verification | W9 | 1 day |
| M8: Tests + docs + rollout | W10, W11 | 2 days |

Total: ~15 days of focused work. Recommend shipping behind a feature flag (`promptroot.multiTenantWiki`) for the first two weeks; flip to GA after dogfooding the migrated `promptroot` tenant. Each milestone is one PR; M2, M3, and M4 are the heavy ones and could split further if review fatigue becomes a concern. M4 unblocks agent-driven authoring — without it, Claude Code can only read via the existing skill, not write.
