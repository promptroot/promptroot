---
title: Short Human Readable Title
slug: short-kebab-case-slug
date: 2026-01-01
status: proposal
owner: your-handle
tags: [area, subsystem, capability]
visibility: public
related: []
---

# SDD: Short Human Readable Title

**Project:** {project name}
**Document Type:** Software Design Document (SDD)
**Date:** YYYY-MM-DD
**Status:** proposal | approved | in-progress | shipped | archived
**Owner:** {handle}

---

## 1. Objective

One paragraph: what are we building and why? Then 2–3 concrete goals:

1. **{Goal 1}.** Description.
2. **{Goal 2}.** Description.

---

## 2. Current State

| Area | Status | Notes |
|------|--------|-------|
| ... | ... | ... |

Gap: what exists today vs. what this SDD closes.

---

## 3. Scope

### In Scope

- ...

### Out of Scope (v1)

- ...

---

## 4. Data Structures

Firestore schemas, API payloads, content models, module state — any structured data this feature owns or introduces.

```
collection/{id}
  ├─ field: type          # description
  └─ subcollection/{id}
       └─ field: type
```

---

## 5. API Contract

Full spec for every HTTP endpoint, Cloud Function, module export, or MCP tool introduced or changed.

### {Endpoint or interface name}

```
POST /functionName
Request:  { field: type, optionalField?: type }
Response: { field: type }

Auth:     Bearer session token | Firebase ID token | none
Errors:   400 (validation), 401 (unauthenticated), 403 (unauthorized), 404 (not found)
```

---

## 6. Architecture

### 6.1 System Shape

File/component tree for what gets created or significantly changed.

```
src/
  └─ modules/
       └─ new-module.js     # what it owns
```

### 6.2 Data Flow

Numbered sequence from trigger to result:

1. ...
2. ...
3. ...

### 6.3 Key Design Choices

Decisions baked in before workstreams start. Resolved open-questions from iteration go in §12.

---

## 7. Workstreams

### W1 — {Name}

- [ ] task
- [ ] task

**Exit criteria:** what must be true before W1 is done.

### W2 — {Name}

- [ ] task

**Exit criteria:** ...

---

## 8. Testing Infrastructure

### Unit Tests (Vitest, `src/unit-tests/`)

| File | What it covers |
|------|----------------|
| `modules/{module}.test.js` | ... |

### E2E Tests (Playwright, `e2e-tests/e2e/`)

**Smoke (runs on every PR):**
- [ ] critical path scenario

**Extended (manual trigger):**
- [ ] full coverage scenario

### Regression Gate

```bash
npm run test:run
npm run test:e2e:smoke
```

---

## 9. Failure Modes

| Failure | Trigger condition | System behavior | Recovery |
|---------|-------------------|-----------------|----------|
| ... | ... | graceful degradation / hard error | ... |

---

## 10. Acceptance Criteria

Numbered, testable. Each maps to a unit test, E2E test, or explicit manual check.

1. ...
2. ...

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ... | High / Med / Low | ... |

---

## 12. Resolved Decisions

| Question | Decision |
|----------|----------|
| ... | ... |

---

## 13. Open Questions

1. **{Question}.** Context. Options being considered.

---

## 14. File Impact Summary

- `src/modules/new-module.js` — created; owns X behavior
- `src/utils/constants.js` — adds constants for Y
- `functions/index.js` — adds Cloud Function Z

---

## 15. Milestones

| Milestone | Workstreams | Effort | Status |
|-----------|-------------|--------|--------|
| M1: ... | W1 | X days | proposal |

---

## 16. Version History

- `v0.1.0` (YYYY-MM-DD): Initial draft.
