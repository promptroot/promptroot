# SDD Authoring Guide

This directory holds every Software Design Document for PromptRoot. Each file is the source of truth for one design decision, surfaced in the Dev History Wiki at `/wiki` and indexed for agent retrieval via the `ragQuery` Cloud Function.

## How to add an SDD

1. Copy `_template.md` to a new file at `docs/sdd/<slug>.md` (or `docs/sdd/private/<slug>.md` if it must be gated).
2. Fill in the frontmatter (see schema below). The `slug` must match the filename stem.
3. Write the document. Use `##` headings to delimit sections; the indexer chunks on those boundaries.
4. Open a PR. CI runs `scripts/validate-sdd-frontmatter.js` and will fail the PR on schema violations.
5. On merge to `main`, the wiki indexer rebuilds `_index.json` and Firestore chunks automatically.

## Frontmatter schema

```yaml
---
title: Short Human Readable Title       # required, string
slug: short-kebab-case-slug             # required, must equal filename stem
date: 2026-01-01                        # required, ISO 8601 date
status: proposal                        # required: proposal | approved | in-progress | shipped | archived
owner: your-handle                      # required, string
tags: [area, subsystem]                 # required, array of strings (may be empty)
visibility: public                      # required: public | private
related:                                # required, array of slugs (may be empty)
  - other-sdd-slug
---
```

### Field rules

- **slug.** Must equal the filename without `.md`. Kebab-case, lowercase.
- **date.** ISO 8601 (`YYYY-MM-DD`). Used by the wiki timeline view.
- **status.** One of the five values above. New docs typically start at `proposal`, move to `approved` once work begins, then `in-progress`, then `shipped`. `archived` for superseded docs that should remain searchable but flagged as historical.
- **visibility.** `public` for everything by default. `private` only for docs that contain genuinely sensitive content (incident details, unreleased features, credentials-adjacent material). Files under `docs/sdd/private/` must declare `visibility: private`; files outside that path must declare `visibility: public`. CI enforces both directions.
- **related.** Slugs of other SDDs that this one references or supersedes. Powers the wiki graph view and the "related docs" sidebar in agent responses.

## File layout

```
docs/sdd/
  README.md                  this file
  _template.md               scaffold for new SDDs
  _index.json                generated; do not edit by hand
  <slug>.md                  public SDDs
  private/
    <slug>.md                private SDDs (CODEOWNERS-protected)
```

## Style notes

- Lead with structured tables and bullet lists where possible. The retrieval layer is keyword-based; structured content ranks better.
- Use `## N. Section Name` for top-level sections so chunk boundaries are predictable.
- Cross-link other SDDs by their wiki URL (`https://promptroot.ai/wiki#<slug>`) rather than by relative file path so links survive moves.
- Avoid em dashes per project style. Use commas, parentheses, or two separate sentences.
