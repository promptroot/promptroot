# @promptroot/mcp-server

CLI + MCP server for the [PromptRoot](https://promptroot.ai) dev-history wiki. Lets humans and AI coding agents (Claude Code, Cursor, Continue, Cline, …) read and write SDDs (Software Design Documents) without leaving the editor.

## Install

```sh
npm install -g @promptroot/mcp-server
```

The package ships four binaries:

| Binary | Purpose |
|--------|---------|
| `promptroot-mcp-login` | One-time auth via GitHub OAuth device flow. Writes a `prs_`-prefixed session token to your home dir. |
| `promptroot-tenant-init` | Pick a tenant interactively. Writes `.promptroot-tenant` and an `AGENTS.md` template at the repo root. |
| `promptroot-sdd-push` | Push a markdown file with YAML frontmatter — creates if new, updates if the slug already exists. |
| `promptroot-mcp-server` | The MCP stdio server. Spawned by Claude Code et al.; you don't run it directly. |

## First-time setup

```sh
promptroot-mcp-login
# → CLI prints a verification URL and a one-time code
# → open the URL in any browser, paste the code, click Authorize
# → token saved to ~/.config/promptroot/credentials.json (chmod 600)
#                  or %APPDATA%\promptroot\credentials.json (Windows)
```

Then in each repo whose SDDs should land in a particular tenant:

```sh
cd /path/to/your-repo
promptroot-tenant-init
# → lists your tenants, you pick one
# → writes .promptroot-tenant (single line: the tenant slug)
# → writes/refreshes AGENTS.md so future agents know where to look
```

The marker file lets every other binary and any MCP-enabled agent resolve which tenant to use without re-asking you.

## Path A — push markdown files from a terminal (no agent needed)

Author an SDD as a `.md` file with YAML frontmatter:

```markdown
---
title: Notification System
slug: notifications
date: 2026-05-04
status: proposal
owner: jesse
tags: [notifications, design]
related: [auth-refactor]
visibility: private
---

# Notifications

Body in regular markdown...
```

Required frontmatter keys: `title`, `slug`, `date`, `status`, `owner`, `tags`, `related`, `visibility`. `tags` and `related` must be present but may be empty arrays (`[]`).

Push it:

```sh
promptroot-sdd-push my-sdd.md
```

The command creates the SDD if the slug is new, or updates it (writing a new version) if the slug already exists in the tenant. Old versions are preserved either way.

| Flag | Effect |
|------|--------|
| `--tenant <slug>` | Override tenant resolution (defaults to `.promptroot-tenant` → git remote). |
| `--note "msg"` | Attach a change note to the new version (visible in `/wiki/history`). |
| `--help` | Print usage and exit. |

Output reports whether it created or updated, the version ID, and the URL of the rendered page.

## Path B — wire up an MCP-capable agent

Register the server with Claude Code:

```sh
claude mcp add -s user promptroot promptroot-mcp-server
```

`-s user` makes it available across all your repos (recommended). Drop the flag to scope to the current project only.

Reload your editor (in VS Code: `Ctrl+Shift+P` → **Developer: Reload Window**). Verify with:

```sh
claude mcp list
# → promptroot: ✓ Connected
```

For Cursor, Continue, Cline, etc., consult their MCP configuration docs and point them at the `promptroot-mcp-server` binary.

### Tools the MCP server exposes

| Tool | Purpose |
|------|---------|
| `promptroot_search_sdds` | BM25 search across SDDs (federated across all tenants you're a member of, plus public tenants). Returns ranked chunks with citation URLs. |
| `promptroot_list_sdds` | List all SDDs in a tenant — slug, title, status, last modified. |
| `promptroot_get_sdd` | Fetch one SDD's body, frontmatter, and headings. Optionally pin to a specific `versionId`. |
| `promptroot_create_sdd` | Create a new SDD from frontmatter + body. Returns the new version ID. |
| `promptroot_update_sdd` | Update an existing SDD. Writes a new version; old versions are preserved. |
| `promptroot_list_versions` | List version history for an SDD with author, timestamp, and change note. |
| `promptroot_restore_version` | Roll back to an earlier version. Non-destructive — writes the old body as a new version. |

Each tool accepts an optional `tenantId`. If omitted, the server resolves it via the chain above.

## Tenant resolution

Every read and write is scoped to one tenant. The package resolves which tenant in this order:

1. **Explicit argument** — `--tenant <slug>` on a CLI binary, or `tenantId` in an MCP tool call.
2. **`.promptroot-tenant` file** at the current working dir's git root (single line, the tenant slug).
3. **`git remote get-url origin`** matched against `tenants[].githubRepo` for the authenticated user.

Write paths error if no resolution succeeds; read paths fall back to public tenants.

## Authentication model

- Same GitHub identity as the PromptRoot web app — no Personal Access Tokens, no separate credentials.
- Device flow keeps the bearer token off your terminal scrollback. Tokens are `prs_`-prefixed and stored hashed server-side.
- Each device gets its own session row in PromptRoot's `userSessions` collection. Visit your profile (when the UI ships) to see and revoke individual sessions, or call the `revokeSession` Cloud Function directly.
- Signing out of PromptRoot revokes all your sessions. Revoking PromptRoot's GitHub OAuth grant kills every session immediately.

## Configuration via env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROMPTROOT_API_BASE` | `https://us-central1-promptroot-b02a2.cloudfunctions.net` | Override the Cloud Functions base URL. Useful for self-hosted deployments or local emulator testing. |
| `PROMPTROOT_DEVICE_FLOW_URL` | (server-supplied) | Override the user-facing device-auth URL printed by `promptroot-mcp-login`. The CLI prefers this over whatever the server suggests. |
| `PROMPTROOT_CREDENTIALS_PATH` | `~/.config/promptroot/credentials.json` (Unix), `%APPDATA%\promptroot\credentials.json` (Windows) | Override where the session token is read/written. |
| `PROMPTROOT_SESSION_TOKEN` | _(none)_ | Bypass the credentials file with an inline token. Useful in CI where you don't want to persist a token to disk. |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `claude mcp list` → `promptroot: ✗ Failed to connect` | Server binary failed at startup, usually after `npm link` from a source checkout that hasn't run `npm install`. | `npm install` in the source dir, or reinstall from the registry: `npm install -g @promptroot/mcp-server@latest`. |
| `Could not resolve tenantId` from any CLI/tool | No marker file, no git remote match, no explicit arg. | `promptroot-tenant-init` in the repo, or pass `--tenant <slug>` (CLI) / `tenantId` (MCP). |
| `401 Not signed in` from any tool call | Session token missing, expired, or revoked. | `promptroot-mcp-login` again. |
| `403 Tenant not accessible` on a write | You're not a member of that tenant. | Get added to the tenant's `members[]` via the tenant CRUD UI on PromptRoot. |
| `409` on `promptroot_create_sdd` / `promptroot-sdd-push` | SDD with that slug already exists. | `promptroot-sdd-push` auto-falls-back to update; for the MCP tool, switch to `promptroot_update_sdd`. |
| Frontmatter parse errors from `promptroot-sdd-push` | Multi-line scalars, anchors, or other complex YAML. | Use the supported subset: scalars, `key: [a, b]` inline arrays, or `key:\n  - a\n  - b` multi-line lists. |

## License

AGPL-3.0-only.
