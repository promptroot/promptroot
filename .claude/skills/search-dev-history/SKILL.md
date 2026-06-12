---
name: search-dev-history
description: Search the PromptRoot dev history wiki for prior SDDs, design
  decisions, and past implementation context. Use whenever the user asks
  "why did we...", references a past decision, mentions "the wiki," or when
  you need historical context before proposing a non-trivial change. Returns
  ranked markdown chunks with wiki URLs for citation.
---

# search-dev-history

Read-only search of the PromptRoot dev history wiki via its public RAG endpoint. Returns BM25-ranked chunks with citation URLs.

## When to use

- User asks about a past decision ("why do we use X?", "didn't we try Y before?").
- User references "the wiki," "dev history," or a specific SDD by name.
- You're about to propose a non-trivial architectural change and want to check for prior context.
- User asks "what's the status of `<project>`" that might be tracked in an SDD.

## Prefer the MCP tool when available

If `@promptroot/mcp-server` is installed and the `promptroot_search_sdds` MCP tool is available in your session, use that instead. It handles authentication, tenant resolution, and unlocks search across the user's private tenants. This skill is the fallback for sessions where MCP isn't wired up.

For write paths (creating or updating SDDs), this skill cannot help — use the MCP tools (`promptroot_create_sdd` / `promptroot_update_sdd`) or shell out to `promptroot-sdd-push <file.md>` if the user has the package installed.

## How to call (HTTP fallback)

```sh
curl -s -X POST https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery \
  -H "Content-Type: application/json" \
  -d '{"query": "<the user question or topic>", "topK": 5, "tenantId": "<tenant slug if known>"}'
```

### Tenant resolution for the unauthenticated call

- If `.promptroot-tenant` exists at the repo root, read its single line and pass that as `tenantId`.
- Otherwise omit `tenantId` to search the public seed tenant (PromptRoot's own dev history) plus any other public tenants.
- Private tenants are unreachable via this skill — direct the user to install the MCP server if they need their own tenant searched.

## Response shape

```json
{
  "results": [
    {
      "docPath": "wiki/vscode-extension-store.md",
      "slug": "vscode-extension-store",
      "tenantId": "promptroot",
      "heading": "A3. Update package.json Metadata",
      "text": "...chunk content...",
      "score": 0.87,
      "url": "https://promptroot.ai/wiki#vscode-extension-store"
    }
  ]
}
```

## How to use results

1. Read each chunk's `text` for context before answering.
2. When citing, link back via `url` so the user can open the source SDD.
3. If no result scores meaningfully above others, tell the user nothing relevant was found rather than forcing weak matches into the response.
4. Do not invent content not present in the returned chunks.
