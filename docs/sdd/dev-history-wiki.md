---
title: Development History Wiki (RAG-Accessible)
slug: dev-history-wiki
date: 2026-04-13
status: in-progress
owner: jesse
tags: [infra, rag, wiki, docs, agents]
visibility: public
related:
  - vscode-extension-store
  - modular-sdd-prompt-planner
---

# SDD: Development History Wiki (RAG-Accessible)

**Project:** PromptRoot Dev History Wiki
**Document Type:** Software Design Document (SDD)
**Date:** 2026-04-13
**Status:** Approved / Ready to Implement
**Approach:** Homegrown (vanilla JS + Firebase, fits existing PromptRoot stack)
**Website:** [https://promptroot.ai](https://promptroot.ai)

---

## 1. Objective

Build a central "wiki" inside PromptRoot that houses every SDD plan, design note, and postmortem produced during development, with three goals:

1. **Human UX.** A browsable UI at `/wiki` that lets a developer visualize and navigate the full history of design decisions (tree, timeline, graph, full-text).
2. **Agent UX.** A RAG-friendly HTTP endpoint so Claude Code, Jules, and other agents can pull relevant historical context into their prompts automatically.
3. **Access control.** Public-read for the vast majority of content, with an auth gate for anything marked `visibility: private` (infra secrets, incident details, unreleased features).

Markdown files in git remain the source of truth. The wiki is a read layer plus a retrieval layer over that corpus.

---

## 2. Current State

| Area | Status | Notes |
|------|--------|-------|
| SDD plan storage | Ad-hoc | `docs/SDD_*.md` files directly in `docs/` |
| Cross-references | Manual | Authors link by filename, no backlink index |
| Discoverability | Poor | Requires `ls docs/` or repo search |
| Agent context | Manual copy-paste | No RAG pipeline; agents rely on ad-hoc file reads |
| Access control | Public only | No separation between public plans and sensitive ones |
| Existing SDD docs | 3 | `SDD_VSCODE_EXTENSION_STORE.md`, `SDD_MODULAR_SDD_PROMPT_PLANNER.md`, `SDD_DEV_HISTORY_WIKI.md` (this doc) |

---

## 3. Architecture

### 3.1 Shape

```
docs/sdd/                    (source of truth, markdown + frontmatter)
  ├── _template.md
  ├── _index.json            (generated at build time)
  ├── vscode-extension-store.md
  ├── modular-sdd-prompt-planner.md
  ├── dev-history-wiki.md
  └── private/               (gated docs, indexed with visibility=private)

pages/wiki/wiki.html         (entry point, public route)
src/pages/wiki-page.js       (initialization)
src/modules/wiki-*.js        (index, renderer, tree, timeline, graph)
src/utils/rag-client.js      (in-app retrieval helper)

functions/index.js           (adds ragQuery callable function)

.github/workflows/wiki-index.yml   (on merge: chunk, upload to Firestore)
scripts/build-wiki-index.js        (the chunker + indexer)

Firestore:
  wikiChunks/{id}            { docPath, heading, chunkIndex, text,
                               visibility, tags[], tokens[], date }
  wikiDocs/{slug}            { title, date, status, owner, tags, related,
                               visibility, headings[] }
```

### 3.2 Data flow

**Ingest (on PR merge to main)**
1. GH Action runs `scripts/build-wiki-index.js`.
2. Script walks `docs/sdd/**/*.md`, parses frontmatter.
3. Each doc is chunked by `##` heading boundaries (SDDs are structured, so heading chunks retrieve better than naive splits). Oversized sections are subdivided at ~500 tokens.
4. Each chunk is tokenized (lowercase, strip markdown, split on non-word chars, drop stopwords) and the token array is stored alongside the text. No embeddings, no external API calls, no keys.
5. Chunks written to Firestore `wikiChunks/*`; doc metadata written to `wikiDocs/*`; `docs/sdd/_index.json` written back to the repo (committed by the action) so the UI can load the full tree without a Firestore round-trip.

**Browse (human)**
1. User hits `/wiki`. `wiki-page.js` fetches `docs/sdd/_index.json`.
2. Sidebar tree renders from the index.
3. On doc select, the raw markdown is fetched via the same `github-api.js` path the prompt browser uses (cached via the service worker).
4. `wiki-renderer.js` renders with `marked.js` + DOMPurify. Private docs check auth before fetching.

**Retrieve (agent)**
1. Agent POSTs `{ query, topK, visibility }` to the `ragQuery` Cloud Function.
2. Function tokenizes the query with the same tokenizer used at index time, pulls candidate chunks from `wikiChunks` filtered by visibility the caller is authorized for.
3. Ranks in memory via BM25 over the stored `tokens[]` field, boosting matches that land in `heading` or frontmatter `tags`.
4. Returns `[{ docPath, heading, text, score, url }]`. Agent assembles chunks into its prompt context.

### 3.3 Why keyword search (BM25) is sufficient for v1

- Corpus is small (3 SDDs today, projected ~30 within a year) and written by a small group in consistent vocabulary drawn from the codebase. Paraphrase handling matters less when the same person writes most of the content.
- SDDs already carry structured metadata (tags, headings, `related[]` links) that a keyword ranker exploits directly. Authoring convention does most of the semantic work.
- Typical agent queries ("what did we decide about caching?", "why is auth on Firebase?") are keyword-dense and resolve well without embeddings.
- Zero external API dependencies. Fits PromptRoot's BYOK philosophy: no project-owned keys in GH Actions or Cloud Functions config, no per-token costs, no cold-start penalty from loading an embedding model.

### 3.4 Upgrade path if keyword search proves insufficient

The `wikiChunks` schema reserves room for a future `embedding[]` field. If retrieval quality ever becomes a real bottleneck, add `@xenova/transformers` to the indexer and the Cloud Function for local (keyless) embeddings, rank by a weighted blend of BM25 and cosine, and the UI + agent integration paths remain unchanged. Not planned; documenting only so the schema does not need to change later.

---

## 4. Content Model

### 4.1 Frontmatter schema

Every file in `docs/sdd/` must start with:

```yaml
---
title: Development History Wiki
slug: dev-history-wiki
date: 2026-04-13
status: approved          # proposal | approved | in-progress | shipped | archived
owner: jesse
tags: [infra, rag, docs]
visibility: public        # public | private
related:
  - modular-sdd-prompt-planner
  - vscode-extension-store
---
```

`slug` is the filename stem. `related` entries are other slugs; used to build the graph view and for "related docs" in RAG responses.

### 4.2 Template

`docs/sdd/_template.md` provides a scaffold mirroring the existing SDD structure (Objective, Current State, Architecture/Workstreams, Open Questions, Milestones). Linted in CI.

### 4.3 Validation

`scripts/validate-sdd-frontmatter.js` runs in CI on every PR:
- Required fields present and typed correctly
- `slug` matches filename
- `related` slugs resolve to existing files
- `visibility` is `public` or `private`
- Files under `docs/sdd/private/` must declare `visibility: private`
- Fails PR on violation

---

## 5. Workstreams

### W1 — Content model & repo layout ✅

- [x] Create `docs/sdd/` directory (with `private/` subdirectory)
- [x] Move existing `docs/SDD_VSCODE_EXTENSION_STORE.md` to `docs/sdd/vscode-extension-store.md` with frontmatter
- [x] Move existing `docs/SDD_MODULAR_SDD_PROMPT_PLANNER.md` to `docs/sdd/modular-sdd-prompt-planner.md` with frontmatter
- [x] Move this doc to `docs/sdd/dev-history-wiki.md` with frontmatter
- [x] Add `docs/sdd/_template.md` scaffold
- [x] Add `docs/sdd/README.md` with authoring guide
- [x] Add `scripts/validate-sdd-frontmatter.js` plus shared `scripts/lib/sdd-frontmatter.js`
- [x] Wire validator into `.github/workflows/test.yml` via `npm run validate:sdd`
- [x] Leave stub files at old SDD paths pointing to new locations

### W2 — Wiki UI (`pages/wiki/`) ✅

- [x] `pages/wiki/wiki.html` entry point following the existing page-init pattern
- [x] `src/pages/wiki-page.js` initialization module, calls `initializeSharedComponents('wiki')`
- [x] `src/modules/wiki-index.js` loads `docs/sdd/_index.json`
- [x] `src/modules/wiki-renderer.js` renders a selected doc via `marked.js` + DOMPurify
- [x] `src/modules/wiki-tree.js` sidebar tree (reuse patterns from `prompt-list.js`)
- [x] `src/modules/wiki-timeline.js` timeline view driven by frontmatter `date`
- [x] `src/modules/wiki-graph.js` force-directed graph of `related[]` links (lazy-loaded Cytoscape.js)
- [x] `src/modules/wiki-search.js` in-page keyword search (local, no server)
- [x] `src/styles/pages/wiki.css` styling (imported in `src/styles.css`)
- [x] Header nav entry + Firebase rewrite for `/wiki`
- [x] Service worker: add wiki page assets to `STATIC_ASSETS`

### W3 — Retrieval pipeline (keyword-based, keyless) ✅

- [x] `scripts/build-wiki-index.js` (Node): walk `docs/sdd/`, parse frontmatter, chunk by heading, tokenize, emit `_index.json` + `_chunks.json`. Zero external API calls. (v1 hosts chunks as a static JSON file rather than Firestore; upgrade path documented in §3.4)
- [x] Shared tokenizer: `src/utils/tokenizer.js` (ESM, frontend) mirrored by `scripts/lib/tokenizer.cjs` (CJS, build + Cloud Function). Parity test in `src/unit-tests/utils/tokenizer.test.js` guards against drift.
- [x] `.github/workflows/wiki-index.yml`: runs on push to main that touches `docs/sdd/**`, executes the script, commits updated index + chunks.
- [x] Cloud Function `ragQuery` in `functions/index.js`:
  - Input: `{ query: string, topK?: number, includePrivate?: boolean }`
  - Tokenizes query with shared tokenizer
  - Fetches hosted `_chunks.json` with a 5-minute in-memory cache
  - Ranks via BM25 over `tokens[]`, with heading and tag matches boosted
  - Returns top K with `{ docPath, slug, heading, chunkIndex, text, score, url }`
- [x] Firestore rules on `wikiChunks` and `wikiDocs` enforce `visibility == 'public'` for unauthenticated reads (reserved for a future Firestore-backed upgrade; v1 reads from hosted JSON).

### W4 — Agent integration

Three discovery paths, one endpoint. No MCP servers, no custom protocols.

**W4.1 Claude Code (skill-based auto-discovery)**

- [ ] `.claude/skills/search-dev-history/SKILL.md` shipped in the repo. Claude Code auto-loads project-scoped skills on session start; the frontmatter `description` is what triggers the model to invoke it.
- [ ] Skill body instructs the model to `curl` the `ragQuery` endpoint with the user's query, parse `results[]`, and cite each chunk by its `url`.
- [ ] v1 skill queries public docs only. Private-doc access from Claude Code is deferred (see Open Question #2).
- [ ] See Appendix A for the full `SKILL.md` contents.

**W4.2 Jules (prompt-time enrichment)**

Jules does not auto-discover tools or skills. Context must be injected before the task leaves PromptRoot.

- [ ] `src/modules/jules-queue.js` calls `ragQuery({ query: taskPrompt, topK: 5 })` before submitting to the Jules API.
- [ ] Returned chunks are prepended to the prompt inside a `## Relevant Prior Design Decisions` section with wiki URLs as citations.
- [ ] Add a per-task toggle in the queue UI ("Enrich with wiki context," default on) so the user can disable enrichment for tasks where history would be noise.
- [ ] `AGENTS.md` at repo root tells Jules: "Relevant design history is injected into your prompt automatically. Do not attempt to call external endpoints."

**W4.3 Generic HTTP fallback**

- [ ] `docs/AGENT_CONTEXT.md` documents the `ragQuery` contract (endpoint, auth, request/response shape) for any agent that reads repo-level docs.
- [ ] `CLAUDE.md` gets a short pointer to the skill and the endpoint so non-skill-aware agents still find it.

**W4.4 In-app use**

- [ ] `src/utils/rag-client.js` wrapper used by the wiki UI for "related docs" sidebars and by other pages that want in-app retrieval.
- [ ] "Copy as agent context" button on each wiki page that bundles the current doc + top-3 related chunks into clipboard-ready markdown.

### W5 — Auth & private docs

- [ ] Extend `auth.js` to expose `currentUserCanSeePrivateDocs()` (boolean derived from existing auth state; start as "any signed-in user," refine to a Firestore allowlist later if needed)
- [ ] `wiki-renderer.js` checks visibility before fetching raw markdown for private docs (prevents content flash)
- [ ] `ragQuery` filters by visibility server-side; `includePrivate=true` requires authenticated caller
- [ ] Firestore rules: `wikiChunks` and `wikiDocs` with `visibility == 'private'` require `request.auth != null`
- [ ] CODEOWNERS entry for `docs/sdd/private/` so merges require review

### W6 — Testing

Test coverage matches existing PromptRoot conventions: Vitest for unit in `src/unit-tests/`, Playwright for E2E in `e2e-tests/`. Coverage thresholds in `vitest.config.js` apply.

**W6.1 Unit tests (Vitest, `src/unit-tests/`)**

Covering W1 content model:

- [ ] `scripts/validate-sdd-frontmatter.test.js` — valid frontmatter passes; missing required fields fail; slug/filename mismatch fails; unresolved `related` slug fails; public file in `private/` path fails; private file outside `private/` path fails.

Covering W2 wiki UI:

- [ ] `modules/wiki-index.test.js` — loads `_index.json`, surfaces parse errors, filters by visibility scope.
- [ ] `modules/wiki-renderer.test.js` — renders markdown, escapes XSS via DOMPurify, respects `visibility: private` gate, handles missing doc with graceful error.
- [ ] `modules/wiki-tree.test.js` — builds tree from index, handles nested folders, collapse/expand state, selection.
- [ ] `modules/wiki-timeline.test.js` — orders by date descending, groups by month, handles missing dates.
- [ ] `modules/wiki-graph.test.js` — builds nodes/edges from `related[]`, dedupes bidirectional links, handles orphan docs.
- [ ] `modules/wiki-search.test.js` — keyword match in title/heading/body, case-insensitive, highlights match positions.

Covering W3 retrieval pipeline:

- [ ] `utils/tokenizer.test.js` — lowercases, strips markdown, drops stopwords, splits consistently for index and query.
- [ ] `scripts/build-wiki-index.test.js` — chunks by `##` boundaries, splits oversized sections at ~500 tokens, emits valid `_index.json` shape, preserves frontmatter metadata on each chunk.
- [ ] `modules/rag-client.test.js` — builds valid POST body, handles network error, handles empty results, respects topK.
- [ ] Cloud Function `ragQuery` tests in `functions/test/ragQuery.test.js` — tokenizes query correctly, BM25 ranks a fixture set in expected order, heading/tag boost increases score, visibility filter excludes private chunks for unauthenticated calls, returns topK.

Covering W4 agent integration:

- [ ] `modules/jules-queue.test.js` — enrichment path calls `ragQuery` when toggle on, skips when toggle off, prepends results in expected `## Relevant Prior Design Decisions` format, handles empty results by omitting the section, handles `ragQuery` failure by submitting unenriched prompt with a warning toast.

Covering W5 auth:

- [ ] `modules/auth.test.js` — extend existing tests to cover `currentUserCanSeePrivateDocs()` logic.
- [ ] Firestore rules unit tests via `@firebase/rules-unit-testing` in `config/firestore/rules.test.js`: unauthenticated read of public chunk succeeds; unauthenticated read of private chunk fails; authenticated read of private chunk succeeds; write from client always fails.

**W6.2 E2E tests (Playwright, `e2e-tests/e2e/`)**

Smoke suite (`e2e-tests/e2e/smoke/wiki.spec.js`, runs on every PR):

- [ ] `/wiki` loads and renders sidebar tree with all public SDDs.
- [ ] Clicking a doc in the tree navigates and renders the markdown content.
- [ ] Header nav "Wiki" link is present and navigates correctly.
- [ ] Unauthenticated user cannot see entries under `docs/sdd/private/` in the tree.

Extended suite (`e2e-tests/e2e/extended/wiki-extended.spec.js`, manual trigger):

- [ ] Timeline view renders with correct chronological ordering.
- [ ] Graph view renders nodes and edges based on `related[]` frontmatter.
- [ ] Client-side keyword search returns results across title/heading/body.
- [ ] "Copy as agent context" button copies expected markdown bundle to clipboard.
- [ ] Authenticated user with access sees private docs in tree and can render them.
- [ ] Service worker serves the wiki page offline on second load.
- [ ] RAG endpoint called from the UI returns ranked results and renders a "Related docs" sidebar.
- [ ] Jules queue task enrichment: creating a task with the toggle on produces a submission payload containing the enrichment section (verify via emulator intercept).

**W6.3 CI wiring**

- [ ] Unit tests run in existing `.github/workflows/test.yml` (Vitest already wired; new files picked up automatically).
- [ ] Add wiki smoke tests to `.github/workflows/smoke-tests.yml` (Chromium only, matches existing pattern).
- [ ] New workflow `.github/workflows/rules-test.yml` runs Firestore rules tests against the Firebase emulator.
- [ ] Verify coverage thresholds in `vitest.config.js` still pass after new modules are added; adjust module-specific thresholds if needed.

---

## 6. Resolved Decisions

| Question | Decision |
|----------|----------|
| Retrieval algorithm? | BM25 keyword search over tokenized chunks. No embeddings, no external API keys. Fits PromptRoot's BYOK philosophy; hosted embeddings would require a project-owned key that violates it. |
| Embedding fallback? | Reserve an `embedding[]` field on `wikiChunks` for a future local-model upgrade via `@xenova/transformers`. Not implemented in v1. |
| Where do private docs live? | `docs/sdd/private/` in this public repo, gated by Firestore rules and client-side auth check. Accept that the raw markdown is still readable on GitHub; move to a separate private repo only if a truly sensitive doc demands it. |
| Versioning? | Git history is sufficient. No separate revision system in v1. |
| Edit in browser? | No. PR flow only. Revisit in v2 if non-technical contributors need it. |
| Ranking at scale? | BM25 in-memory over filtered Firestore reads comfortably handles projected 1-year corpus (~500 chunks). Revisit past ~10k chunks. |

## 7. Open Questions

1. **Private-doc allowlist granularity.** v1 treats "any signed-in user" as authorized. Do we want a Firestore allowlist (`wikiPrivateReaders/{uid}`) from day one, or add it when the first truly sensitive doc lands?
2. **Private-doc access from Claude Code.** Defer to v2. v1 skill does public-only queries; the Firebase ID token flow is not built. Revisit when a concrete need exists.

---

## 8. Out of Scope (v1)

- In-browser editing
- Multi-tenant wikis
- Full-text server-side search beyond RAG (client-side keyword search only)
- Automatic SDD generation from PRs/commits
- Vector store migration (Firestore is sufficient at current scale)

---

## 9. Milestones

| Milestone | Workstreams | Rough effort |
|-----------|-------------|--------------|
| M1: Content model in place, existing SDDs migrated | W1 | 1 to 2 days |
| M2: Read-only wiki UI live at `/wiki` | W2 | 5 to 7 days |
| M3: RAG endpoint returning citations | W3 | 3 to 5 days |
| M4: Agents pulling context via `ragQuery` | W4 | 2 to 3 days |
| M5: Private docs gated end-to-end | W5 | 2 days |
| M6: Full test coverage (unit + E2E) wired into CI | W6 | 4 to 5 days |

Total: roughly 3.5 to 4.5 weeks of focused work for v1.

Note on sequencing: W6 tests for each module are written alongside that module's implementation, not at the end. The W6 budget captures the increment beyond what lands inside W1-W5 PRs: Firestore rules tests, E2E smoke/extended specs, and CI workflow wiring.

---

## Appendix A: `search-dev-history` skill

Ships at `.claude/skills/search-dev-history/SKILL.md` in the repo root so every Claude Code session opened in this workspace auto-discovers it.

```markdown
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

    curl -s -X POST https://promptroot.ai/api/rag \
      -H "Content-Type: application/json" \
      -d '{"query": "<the user question or topic>", "topK": 5}'

Returns public dev history only. Private-doc access from Claude Code is not
supported in v1.

## Response shape

    {
      "results": [
        {
          "docPath": "docs/sdd/vscode-extension-store.md",
          "slug": "vscode-extension-store",
          "heading": "A3. Update package.json Metadata",
          "text": "...chunk content...",
          "score": 0.87,
          "url": "https://promptroot.ai/wiki#vscode-extension-store/a3"
        }
      ]
    }

## How to use results

1. Read each chunk's `text` for context.
2. When citing, link back via the `url` field so the user can open the
   source wiki page.
3. If no result has `score > 0.5`, tell the user nothing relevant was found
   rather than forcing weak matches into the response.
4. Do not invent content not present in the returned chunks.
```

## Appendix B: Jules enrichment contract

When `jules-queue.js` enriches a task prompt, the prepended section is
formatted as:

```markdown
## Relevant Prior Design Decisions

The following excerpts from the PromptRoot dev history wiki may be relevant
to this task. Source URLs are provided for reference; you do not need to
fetch them.

### [<heading>](<url>)

<chunk text>

---

### [<heading>](<url>)

<chunk text>

---

(end of prior design context)
```

Rationale: the explicit "you do not need to fetch them" line prevents Jules
from wasting budget on outbound requests it cannot make anyway.
