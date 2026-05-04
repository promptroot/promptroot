# AGENTS.md

Guidance for coding agents (Claude Code, Cursor, Continue, Cline, Jules, …) working in any PromptRoot-connected repo.

## Dev history wiki

Prior design decisions and SDDs (Software Design Documents) are stored in PromptRoot's multi-tenant wiki at https://promptroot.ai/wiki. Each app has its own tenant. Read before changing non-trivial code; write when you make a decision worth recording.

## Tenant resolution

Every read and write is scoped to one tenant. Resolve in this order:

1. **Explicit** — caller passes `tenantId` (or `--tenant <slug>`).
2. **`.promptroot-tenant`** file at the repo root (single line: the tenant slug). Run `npx promptroot-tenant-init` to create one.
3. **`git remote get-url origin`** matched against `tenants[].githubRepo` for the signed-in user.

Read paths fall back to public tenants if nothing resolves; write paths error and prompt for `--tenant <slug>`.

## Discovery surfaces (pick the one that fits the agent)

### A. MCP tools (preferred for any MCP-speaking agent)

```sh
npm install -g @promptroot/mcp-server
promptroot-mcp-login                              # one-time GitHub OAuth
claude mcp add -s user promptroot promptroot-mcp-server
```

Tools registered:

| Tool | Purpose |
|------|---------|
| `promptroot_search_sdds` | BM25 search; federated across tenants you can read. |
| `promptroot_list_sdds` | List SDDs in a tenant. |
| `promptroot_get_sdd` | Fetch one SDD body + frontmatter (optionally a past version). |
| `promptroot_create_sdd` | Create a new SDD. |
| `promptroot_update_sdd` | Update — writes a new version; old preserved. |
| `promptroot_list_versions` | Version history. |
| `promptroot_restore_version` | Non-destructive rollback. |

See [`mcp-server/README.md`](mcp-server/README.md) for full tool schemas, env vars, and troubleshooting.

### B. CLI binaries (when MCP isn't an option)

The same `@promptroot/mcp-server` package ships standalone binaries you can shell out to:

- `promptroot-mcp-login` — auth.
- `promptroot-tenant-init` — pick a tenant, write the marker file.
- `promptroot-sdd-push <file.md>` — push a markdown file with YAML frontmatter; creates or updates as appropriate.

If your agent has terminal access but no MCP support, this is the cleanest write path. Required frontmatter keys: `title`, `slug`, `date`, `status`, `owner`, `visibility`. Supported flags: `--tenant <slug>`, `--note "msg"`.

### C. Claude Code skill (read-only fallback)

`.claude/skills/search-dev-history/SKILL.md` queries the public `ragQuery` endpoint without auth. Works only for public tenants. Use when MCP isn't installed and you only need to search.

### D. Jules

PromptRoot's Jules queue auto-injects relevant wiki excerpts into your prompt before submission as `## Relevant Prior Design Decisions`. Don't try outbound HTTP — what matters is already in scope.

### E. Raw HTTP (any agent)

For search:

```
POST https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery
Content-Type: application/json

{ "query": "<question>", "topK": 5, "tenantId": "<slug or omit for public>" }
```

Authenticated callers can pass `Authorization: Bearer <prs_session-token>` (from device flow) to federate across all their tenants. Returns `{ results: [{ docPath, slug, tenantId, heading, text, score, url }, ...] }`.

For create/update/list/etc., see the Cloud Function endpoints documented in `CLAUDE.md` under "Dev history wiki."

## When to write an SDD

- Architectural decision with trade-offs that won't be obvious from the code six months later.
- Non-obvious workaround for a third-party bug or constraint.
- Migration plan with checkpoints (status: `in-progress` → `shipped`).
- Incident postmortem.

When in doubt, search first (`promptroot_search_sdds` or the equivalent) — if there's already an SDD on the topic, update it instead of creating a sibling.

## Conventions

See `CLAUDE.md` for project structure, testing commands, and coding conventions that apply to all changes.
