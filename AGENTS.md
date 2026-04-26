# AGENTS.md

Guidance for coding agents (Jules, Claude Code, etc.) working in this repo.

## Dev history wiki

Prior design decisions and SDDs live at https://promptroot.ai/wiki, with
markdown source at `wiki/*.md` for the seed `promptroot` tenant. Other
apps store SDDs server-side in their own tenant under PromptRoot — there
is no per-repo `wiki/` folder for those.

## Tenant resolution

Every agent integration treats SDDs as scoped to a tenant. Resolve the
tenant in this order:

1. Tool argument or env (`PROMPTROOT_TENANT_ID`).
2. `.promptroot-tenant` file at the repo root, single line containing the
   tenant slug. Run `npx promptroot-tenant-init` to create one.
3. `git remote get-url origin` matched against `tenants[].githubRepo` for
   the authenticated user.

If none resolve, fall back to public-tenant search; reject writes.

## Discovery surfaces

### MCP (preferred for any MCP-speaking agent)

Install the server:

    npm install -g @promptroot/mcp-server
    promptroot-mcp-login         # one-time GitHub OAuth via device flow
    claude mcp add promptroot npx @promptroot/mcp-server

Tools registered: `promptroot_search_sdds`, `promptroot_list_sdds`,
`promptroot_get_sdd`, `promptroot_create_sdd`, `promptroot_update_sdd`,
`promptroot_list_versions`, `promptroot_restore_version`. Cursor,
Continue, and Cline pick up the same server with their own MCP registries.

### Claude Code skill (read-only fallback)

`.claude/skills/search-dev-history/SKILL.md` queries the public ragQuery
endpoint. Use this when the MCP server is not installed.

### Jules

PromptRoot's Jules queue injects relevant wiki excerpts into your prompt
automatically before submission. Look for a
`## Relevant Prior Design Decisions` section near the top of your prompt.
Do not attempt outbound HTTP requests; what matters is already in scope.

### Other agents (raw HTTP)

Any agent can POST to:

    POST https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery
    Content-Type: application/json

    {
      "query": "<user question>",
      "topK": 5,
      "tenantId": "<slug or omit for public>"
    }

Returns `{ results: [{ docPath, slug, tenantId, heading, text, score, url }, ...] }`.

Authenticated callers can pass `Authorization: Bearer <session-token>`
(from the device flow) to federate across all their tenants.

## Conventions

See `CLAUDE.md` for project structure, testing commands, and coding
conventions that apply to all changes.
