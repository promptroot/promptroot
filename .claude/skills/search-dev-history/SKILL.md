---
name: search-dev-history
description: Search the PromptRoot dev history wiki for prior SDDs, design
  decisions, and past implementation context. Use whenever the user asks
  "why did we...", references a past decision, mentions "the wiki," or when
  you need historical context before proposing a non-trivial change. Returns
  ranked markdown chunks with wiki URLs for citation.
---

# search-dev-history

Query the PromptRoot dev history wiki via its RAG endpoint and return the
top relevant chunks.

## When to use

- User asks about a past decision ("why do we use X?", "didn't we try Y before?")
- User references "the wiki," "dev history," or a specific SDD by name
- You are about to propose a non-trivial architectural change and want to
  check for prior context
- User asks "what's the status of <project>" that might be tracked in an SDD

## How to call

If the user has installed `@promptroot/mcp-server` and you have the
`promptroot_search_sdds` MCP tool available, prefer that — it handles
authentication and tenant resolution for you, and unlocks search across
private tenants.

Otherwise, hit the public ragQuery endpoint:

    curl -s -X POST https://us-central1-promptroot-b02a2.cloudfunctions.net/ragQuery \
      -H "Content-Type: application/json" \
      -d '{"query": "<the user question or topic>", "topK": 5, "tenantId": "<tenant slug if known>"}'

Tenant resolution:

- If a `.promptroot-tenant` file exists at the repo root, read its single
  line and pass that as `tenantId`.
- Otherwise, omit `tenantId` to search the default seed tenant
  (PromptRoot's own dev history) or all public tenants.
- Authenticated callers (via the MCP tool) federate across all tenants
  they belong to.

## Response shape

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

## How to use results

1. Read each chunk's `text` for context.
2. When citing, link back via the `url` field so the user can open the
   source wiki page.
3. If no result scores meaningfully above others, tell the user nothing
   relevant was found rather than forcing weak matches into the response.
4. Do not invent content not present in the returned chunks.
