---
title: Modular Versioned SDD Prompt Planner
slug: modular-sdd-prompt-planner
date: 2026-03-15
status: proposal
owner: promptroot-core
tags: [prompts, templating, sdd, workflow]
visibility: public
related:
  - vscode-extension-store
---

# SDD: Modular Versioned SDD Prompt Planner

**Project:** PromptRoot Prompt Templating
**Document Type:** Software Design Document (SDD)
**Date:** March 15, 2026
**Status:** v0.1.0 Draft
**Owner:** PromptRoot Core

---

## 1. Objective

Add a reusable prompt-template workflow that lets users:

1. Start from a single SDD template prompt.
2. Fill in a unique feature request/body text.
3. Toggle optional requirement sections via checkboxes (for example: UI documentation, Agent API changes, unit tests, e2e tests).
4. Generate a versioned SDD plan in Markdown.
5. Save/download the generated plan as an `.md` file.

This is a meta-feature intended to produce modular SDD plans with consistent structure and optional sections.

---

## 2. Problem Statement

Current variable substitution supports text placeholders (`{PLACEHOLDER}`) and modal text inputs, but does not natively support checkbox-driven conditional blocks.

This prevents authoring one prompt template that can dynamically include/exclude full SDD sections without manual editing.

---

## 3. Scope

### In Scope

- Template syntax for optional, checkbox-driven sections.
- Modal UI updates for boolean options.
- Conditional rendering engine before "Send to Jules" / "Download" / "Save to GitHub".
- Version metadata conventions in generated SDD output.
- Unit tests and e2e tests for parsing, rendering, and UI behavior.
- New tutorial template for "Versioned Modular SDD Plan".

### Out of Scope

- New backend service or Firestore schema changes.
- AI quality/scoring of generated SDD content.
- Rich template editor (WYSIWYG).

---

## 4. User-Facing Design

### Primary Flow

1. User opens template prompt (for example in `prompts/tutorial/templates/`).
2. User clicks `Customize`.
3. Variable modal shows:
- Text inputs for standard placeholders.
- Checkbox controls for optional sections.
4. User provides `{FEATURE_REQUEST_TEXT}` and toggles options.
5. User clicks `Apply to Text`.
6. System renders final markdown with selected optional sections included.
7. User uses `Copy`, `Download`, or `Save to GitHub` to persist/use the `.md` file.

Notes:

- `Customize` is the required entry point for this workflow.
- `Try in Jules` remains a separate action and is not required for copying or saving the filled template.

### Checkbox Option UX

- Checkbox labels are human-readable.
- Default state per option is explicitly defined in template.
- Options map to section-level inclusion in the generated markdown.

---

## 5. Proposed Template Contract

### Placeholder Types

1. Text placeholders (existing):
- `{FEATURE_REQUEST_TEXT}`
- `{PLAN_VERSION}`
- `{DATE}`

2. Boolean placeholders (new):
- `{INCLUDE_UI_CHANGES}`
- `{INCLUDE_AGENT_API}`
- `{INCLUDE_E2E_TESTS}`
- `{INCLUDE_UNIT_TESTS}`

### Conditional Block Syntax (new)

Use explicit block markers in markdown templates:

```md
{{#if INCLUDE_UI_CHANGES}}
## UI Changes
- Document all screens, states, and interactions affected.
{{/if}}
```

Rules:

- `{{#if FLAG_NAME}} ... {{/if}}` renders only when `FLAG_NAME === true`.
- Unknown flags evaluate as `false`.
- Nested conditionals are not supported in v1.

---

## 6. Architecture Changes

### A. Variable Detection and Field Typing

**Target file:** `src/modules/variable-substitution.js`

Add a light parser layer that classifies placeholders:

- `INCLUDE_*` => checkbox field
- everything else => text field

New helper candidates:

- `detectTemplateVariables(text)` returns typed metadata.
- `renderConditionalBlocks(text, values)` strips/includes `{{#if ...}}` blocks.

### B. Modal DOM Generation

**Target file:** `src/modules/variable-substitution.js`

Update `buildVariableModalDOM(...)`:

- Render checkbox controls for `INCLUDE_*` variables.
- Keep text inputs for non-boolean variables.
- Keep existing textarea preview/edit step.

### C. Value Collection

**Target file:** `src/modules/variable-substitution.js`

Extend `getVariableValues(...)`:

- read checkbox state as boolean
- continue reading text fields as strings

### D. Final Render Pipeline

**Target file:** `src/modules/variable-substitution.js`

On Apply/Continue:

1. substitute text placeholders
2. evaluate conditional blocks
3. write final markdown to textarea and downstream actions

### E. Style Additions

**Target file:** `src/styles/components/variable-modal.css` (or existing variable modal style file)

Add styles for:

- checkbox group container
- checkbox label/help text
- compact responsive layout for many options

---

## 7. Prompt Template Deliverables

Create a new reusable template file:

- `prompts/tutorial/templates/versioned-modular-sdd-plan.md`

Template should include:

- fixed instruction header:
  - "Create a versioned SDD plan to achieve the following"
- unique body placeholder:
  - `{FEATURE_REQUEST_TEXT}`
- optional sections wrapped in conditionals for:
  - UI documentation
  - Agent API additions/adjustments
  - Unit tests
  - e2e tests
  - rollout/observability (optional extra)
- version metadata fields:
  - `{PLAN_VERSION}`
  - `{DATE}`

---

## 8. Testing Strategy

### Unit Tests

**Target file:** `src/unit-tests/modules/variable-substitution.test.js`

Add/adjust tests for:

1. typed variable detection (`INCLUDE_*` -> checkbox)
2. conditional block include when flag=true
3. conditional block removal when flag=false
4. mixed substitution (text + flags)
5. malformed conditional blocks handled safely
6. no regression for existing `{PLACEHOLDER}` behavior

### e2e Tests

**Target file:** `e2e-tests/e2e/extended/variable-substitution.spec.js`

Add/adjust tests for:

1. checkbox controls appear for `INCLUDE_*` fields
2. toggling checkbox updates rendered markdown after `Apply to Text`
3. download contains included sections only
4. "Save to GitHub" URL contains correct rendered content
5. mobile viewport usability of checkbox + textarea flow

### Regression Gate

Run:

```bash
npm run test:run
npm run test:e2e:extended -- variable-substitution.spec.js
```

---

## 9. Implementation Plan (Versioned)

### Phase 1: Template Contract + Parser (v0.1.0)

- Define `INCLUDE_*` convention.
- Implement conditional block renderer.
- Add unit tests for renderer.

Exit Criteria:

- Conditional parser passes all new unit tests.

### Phase 2: Modal Checkbox UI (v0.2.0)

- Render typed fields (text + checkbox).
- Collect boolean values.
- Preserve accessibility labels and keyboard behavior.

Exit Criteria:

- Modal supports mixed inputs without regression.

### Phase 3: End-to-End Actions (v0.3.0)

- Ensure Apply/Continue/Download/Save all use rendered output.
- Add e2e coverage for inclusion/exclusion behavior.

Exit Criteria:

- e2e verifies the full user flow from template to saved markdown.

### Phase 4: Prompt Template + Documentation (v1.0.0)

- Add `versioned-modular-sdd-plan.md` template.
- Update docs/tutorial references.

Exit Criteria:

- Users can open one template, fill unique body text, toggle options, and save a correct versioned SDD markdown file.

---

## 10. Risks and Mitigations

1. Regex-only parsing may break on complex nested conditionals.
- Mitigation: v1 explicitly disallows nested conditionals and validates template structure.

2. Existing tests may assume text-only fields in variable modal.
- Mitigation: preserve existing selectors where possible and add new checkbox selectors.

3. Long generated markdown in URL for Save to GitHub may hit URL-length limits.
- Mitigation: keep download path as primary fallback; optionally truncate with warning when URL exceeds safe threshold.

---

## 11. Acceptance Criteria

1. A single prompt template can generate multiple SDD variants using checkbox options.
2. Generated markdown includes only selected optional sections.
3. Output always includes version metadata.
4. Users can download/save generated markdown without manual copy/paste.
5. Unit and e2e tests cover the new behavior with no regressions in existing variable substitution.

---

## 12. Example Template Snippet

```md
# Versioned SDD Plan - {PLAN_VERSION}
Date: {DATE}

Create a versioned SDD plan to achieve the following:

{FEATURE_REQUEST_TEXT}

{{#if INCLUDE_UI_CHANGES}}
## UI Changes
- Document component and page-level UI updates.
{{/if}}

{{#if INCLUDE_AGENT_API}}
## Agent API Changes
- Document all new/changed agent tools, contracts, and payloads.
{{/if}}

{{#if INCLUDE_UNIT_TESTS}}
## Unit Test Plan
- Add unit coverage for all modified modules and helpers.
{{/if}}

{{#if INCLUDE_E2E_TESTS}}
## E2E Test Plan
- Add end-to-end scenarios for critical user flows.
{{/if}}
```

---

## 13. File Impact Summary

- `src/modules/variable-substitution.js` (core logic + modal generation)
- `src/unit-tests/modules/variable-substitution.test.js` (unit coverage)
- `e2e-tests/e2e/extended/variable-substitution.spec.js` (e2e coverage)
- `src/styles/components/variable-modal.css` (checkbox styling)
- `prompts/tutorial/templates/versioned-modular-sdd-plan.md` (new reusable prompt template)

---

## 14. Version History

- `v0.1.0` (March 15, 2026): Initial SDD for modular versioned SDD prompt planner.
