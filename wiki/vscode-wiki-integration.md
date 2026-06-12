---
title: VS Code Extension — Wiki Integration & Agent Discovery
slug: vscode-wiki-integration
date: 2026-04-14
status: proposal
owner: jesse
tags: [vscode, extension, rag, wiki, agents]
visibility: public
related:
  - dev-history-wiki
  - vscode-extension-store
---

# SDD: VS Code Extension — Wiki Integration & Agent Discovery

**Project:** PromptRoot VS Code Extension (`vscode-extension/`)
**Document Type:** Software Design Document (SDD)
**Date:** 2026-04-14
**Status:** proposal

---

## 1. Objective

Wire the PromptRoot dev history wiki (see `dev-history-wiki`) into the existing VS Code extension so that any AI chat surface inside VS Code — GitHub Copilot Chat, Claude for VS Code, Gemini Code Assist, and future entrants — can pull project-specific design context without the user or the model knowing PromptRoot exists as a separate service. This closes the last discovery gap: Claude Code CLI already has the skill, Jules gets prompt-injected context via PromptRoot's submission path, and generic agents read `AGENTS.md`, but VS Code-hosted assistants currently have no path to the `ragQuery` endpoint.

---

## 2. Current State

| Area | Status | Notes |
|------|--------|-------|
| Extension scaffolding | Shipped | `vscode-extension/` with ~15 commands, dashboard webview, Jules tree views |
| Extension publishing | Planned | Marketplace publish flow tracked in `vscode-extension-store` SDD |
| `ragQuery` endpoint | Shipped | Cloud Function, BM25 over hosted `_chunks.json`, keyless |
| Extension ↔ wiki | None | Zero references to `ragQuery`, `wiki-enrichment`, or `enrichPrompt` in `vscode-extension/src/` |
| Chat participant | Not registered | `@promptroot` unavailable in Copilot Chat |
| Language Model Tool | Not registered | No tool exposed via `vscode.lm.registerTool` |
| Enrichment command | Missing | No "Send with wiki context" command in the palette |

---

## 3. Architecture

### 3.1 Three discovery vectors

The extension ships three complementary integrations. Each has a different discovery mechanic; together they cover the realistic surface area of AI use inside VS Code.

```
vscode-extension/src/
  ├── wiki-client.ts              # thin wrapper over ragQuery (shared)
  ├── wiki-enrichment.ts          # prepend "## Relevant Prior Design Decisions" block
  ├── commands/
  │   └── send-with-wiki.ts       # palette command + context menu entry
  ├── chat/
  │   └── participant.ts          # @promptroot chat participant
  └── tools/
      └── search-dev-history.ts   # LM Tool registration
```

### 3.2 Vector A — Palette command (explicit user action)

Command: `promptroot.sendWithWikiContext`
Entry points: command palette, editor context menu on selection, right-click on a markdown file.

Flow:
1. User selects text (or highlights a prompt in a `.prompt.md` file).
2. Runs the command.
3. Extension calls `ragQuery({ query: selection, topK: 5 })`.
4. Prepends the Appendix B `## Relevant Prior Design Decisions` block.
5. Copies the enriched prompt to the clipboard **and** offers a picker: "Send to Copilot Chat", "Send to Claude", "Copy only". The picker uses whatever chat providers are registered in the host.

**Why this exists:** always works, no API dependencies, covers the case where the user wants explicit control over when history is pulled in.

### 3.3 Vector B — Chat participant `@promptroot`

Registered via the `chatParticipants` contribution point. Any user with GitHub Copilot Chat (the de facto chat surface in VS Code) sees `@promptroot` in the `@`-autocomplete menu.

Flow:
1. User types `@promptroot why did we pick BM25 over embeddings` in Copilot Chat.
2. Participant receives the request, calls `ragQuery({ query: prompt, topK: 5 })`.
3. Streams each result back as a markdown block with `[source](url)` citations.
4. Optionally forwards to the underlying model with enriched context via `request.model.sendRequest(...)`.

**Why this exists:** zero-config discovery for Copilot users. The `@` menu advertises the capability; no one needs to know the endpoint URL.

### 3.4 Vector C — Language Model Tool

Registered via `vscode.lm.registerTool('promptroot_search_dev_history', ...)`. The tool description is published to any chat model that negotiates tool use in the VS Code host.

Tool schema (matches the skill in `.claude/skills/search-dev-history/`):
```json
{
  "name": "promptroot_search_dev_history",
  "description": "Search PromptRoot's dev history wiki for prior SDDs and design decisions. Use before proposing non-trivial architectural changes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "topK": { "type": "number", "default": 5 }
    },
    "required": ["query"]
  }
}
```

Invocation: model decides when to call, receives ranked chunks back, cites them in its response.

**Why this exists:** this is the closest analog to Claude Code's auto-discovered skill. The model picks the tool up from the LM API announcement; neither the user nor the extension needs to mediate. Works for Copilot, Claude for VS Code, and any future chat model that speaks the LM Tool protocol.

### 3.5 Shared layer

`wiki-client.ts` is ~30 lines: `POST` to `ragQuery`, parse `results[]`, surface errors via `error-handler.ts`. All three vectors consume it. `wiki-enrichment.ts` mirrors the web `src/modules/wiki-enrichment.js` byte-for-byte in output format so an agent looking at an enriched Jules prompt and an enriched VS Code prompt sees the same structure. No markdown divergence.

### 3.6 Settings

Contributed configuration (`promptroot.wikiEnrichment`):

| Setting | Default | Effect |
|---------|---------|--------|
| `promptroot.wiki.endpoint` | `https://…/ragQuery` | Overridable for self-hosted deployments |
| `promptroot.wiki.autoEnrich` | `false` | If true, the palette command skips the picker and sends straight to default chat |
| `promptroot.wiki.topK` | `5` | Chunks per query |

---

## 4. Workstreams

### W1 — Shared client and enrichment

- [ ] `vscode-extension/src/wiki-client.ts` with `queryWiki({ query, topK })`, retries, and error surfacing via existing `error-handler.ts`.
- [ ] `vscode-extension/src/wiki-enrichment.ts` with `enrichPrompt(prompt, opts)` matching the web module's output format exactly.
- [ ] Unit tests under `vscode-extension/src/*.test.ts` following existing test style (jest or vitest — match current).
- [ ] Parity test: identical fixture input to web `enrichPrompt` and extension `enrichPrompt` produces identical output strings (guards against drift).

### W2 — Palette command

- [ ] `vscode-extension/src/commands/send-with-wiki.ts` registered as `promptroot.sendWithWikiContext`.
- [ ] Contribution in `package.json` under `contributes.commands` and `contributes.menus.editor/context` with a `when` clause for text selection.
- [ ] Quick-pick for destination (clipboard, Copilot Chat, Claude, default handler).
- [ ] Integration test exercising the command with a mocked `ragQuery`.

### W3 — Chat participant

- [ ] `contributes.chatParticipants` entry in `package.json` registering `promptroot` with id, name, fullName, description, icon.
- [ ] `vscode-extension/src/chat/participant.ts` implementing the `vscode.ChatRequestHandler`.
- [ ] Stream `ragQuery` results as markdown with clickable citations.
- [ ] `followUp` suggestions pointing at related docs from the top result.
- [ ] Handle the case where Copilot Chat is not installed (participant contribution becomes inert, not an error).
- [ ] Manual test matrix: Copilot Chat present/absent, authenticated/unauthenticated, empty results, endpoint failure.

### W4 — Language Model Tool

- [ ] `contributes.languageModelTools` entry in `package.json`.
- [ ] `vscode.lm.registerTool('promptroot_search_dev_history', ...)` in `extension.ts` activation.
- [ ] Input validation mirrors the `ragQuery` request schema exactly.
- [ ] Tool result formatted as structured markdown chunks, matching skill output so Claude Code and VS Code see the same shape.
- [ ] Confirmation prompt configuration (`requireConfirmation: false` — read-only, safe).

### W5 — Settings and privacy

- [ ] `contributes.configuration` entries for endpoint, autoEnrich, topK.
- [ ] Default endpoint points at the production `ragQuery` URL.
- [ ] No telemetry beyond what the extension already collects.
- [ ] Respect `http.proxy` VS Code setting in the HTTP client (the extension already handles this elsewhere — factor shared).

### W6 — Testing

- [ ] Unit: `wiki-client`, `wiki-enrichment`, each command handler. Mirror existing `vscode-extension/src/*.test.ts` conventions.
- [ ] Integration: spin up the extension host in VS Code test runner, register the participant and tool, assert they appear in `vscode.chat.participants` and `vscode.lm.tools`.
- [ ] Manual QA script in `docs/vscode-extension-manual-qa.md` covering palette, participant, tool invocation from Copilot Chat, and the settings surface.

### W7 — Packaging and release

- [ ] Bump `package.json` version to `0.2.0`.
- [ ] Changelog entry.
- [ ] Publish to marketplace as part of the `vscode-extension-store` flow (no separate release train).
- [ ] Update `AGENTS.md` with a "VS Code" section pointing at the participant and tool names so documentation-aware agents can find them.
- [ ] Update `CLAUDE.md` with the same pointers.
- [ ] Update `wiki/dev-history-wiki.md` §3.1 discovery-paths table to add the VS Code row.

---

## 5. Resolved Decisions

| Question | Decision |
|----------|----------|
| Do we ship an MCP server for VS Code instead of an LM Tool? | No — LM Tools are the native VS Code primitive and do not require a user-run subprocess. MCP is reserved for tools that already have one. |
| Chat participant or LM Tool — which to build first? | Both, same release. They serve different surfaces: participant is explicit (`@promptroot`), tool is implicit (model decides). Missing either leaves a discovery gap. |
| Do we need keys for the endpoint? | No — `ragQuery` is keyless in v1 and stays that way for public docs. Private-doc access is deferred in line with `dev-history-wiki` Open Question #2. |
| Share code with the web enrichment module or duplicate? | Duplicate with a parity test. The extension runs in a Node context with different module resolution; sharing would require a workspace package, which is more complexity than the ~30 lines save. Same pattern we used for `tokenizer.js` ↔ `tokenizer.cjs`. |

## 6. Open Questions

1. **Private docs from the extension.** Same question as `dev-history-wiki` Open Question #2 — the signed-in VS Code user has a GitHub identity via the extension's existing auth flow. We could trade that for a short-lived token against `ragQuery` to unlock `includePrivate`. Worth doing in v2 of this SDD, not v1.
2. **Inline citation format for Copilot.** Copilot Chat renders markdown links inline; Claude for VS Code may prefer structured annotations. Default to markdown links, revisit after dogfooding with both hosts.
3. **Rate limiting.** The endpoint has no per-caller limits today. If the extension's LM Tool gets hit aggressively (a model that calls it on every turn), do we need Cloud Function-level throttling? Measure first, decide after one week of usage data.

---

## 7. Out of Scope (v1)

- Write access from the extension (creating or editing SDDs). The extension is a read-only consumer of the wiki in v1.
- Private-doc retrieval. Blocked on auth flow work tracked in `dev-history-wiki`.
- Offline support. The extension hits the live endpoint; offline degradation is a clear error, not a cached fallback.
- Multi-repo wiki federation. One project, one endpoint. Multi-repo is a separate design problem.
- VS Code web (vscode.dev). The LM Tool API and chat participants have partial coverage on the web build; we target desktop VS Code for v1 and revisit once API parity stabilizes.

---

## 8. Milestones

| Milestone | Workstreams | Effort |
|-----------|-------------|--------|
| M1: Shared client and palette command | W1, W2 | 1 day |
| M2: Chat participant | W3 | 1 day |
| M3: LM Tool | W4 | 0.5 day |
| M4: Settings, tests, packaging | W5, W6, W7 | 1 day |

Total: ~3.5 days of focused work. Can ship as a single PR against `main` or split by milestone — recommended single PR since the three vectors share the client layer and splitting would churn `package.json` three times.
