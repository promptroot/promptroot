generate 10 tasks following the
```
# Specification-Driven Execution Roadmap

**Instructions:** Fill in ALL sections below using the inputs provided above. Replace placeholder text with specific, actionable content.

## 0. Clarifications and Assumptions

**If any required inputs are missing or ambiguous, list clarifying questions here:**
- [ ] What is the specific **Feature Name** and **One-Sentence Goal** for this roadmap?
- [ ] Who are the target **Users / Stakeholders**?
- [ ] What are the **Primary Flows (Happy Paths)** and **Edge Cases**?
- [ ] what are the **Acceptance Criteria**?
- [ ] Are there any specific **Time / Scope Constraints**?

**Stated Assumptions (if proceeding without complete inputs):**
- Assumption 1: The feature will follow the existing Zero-Build architecture (Vanilla JS, ES6 Modules).
- Assumption 2: The feature will be deployed to Firebase Hosting / GitHub Pages.
- Assumption 3: Backend logic will reside in Firebase Cloud Functions (Node.js).
- Assumption 4: Data persistence will use Firestore.

*Remove this section if all inputs are complete.*

---

## 1. Purpose and Scope

**Objective:** {ONE_SENTENCE_GOAL} (TBD - pending input)

**In Scope:**  
- {List specific features and behaviors from inputs}
- Implementation of core logic within `src/modules/`
- Integration with existing Firebase services (Auth, Firestore, Functions)
- UI updates using existing CSS components and patterns

**Out of Scope / Non-Goals:**  
- Framework migration (React, Vue, etc.)
- Build step introduction (Webpack, Vite, etc.)
- Anything not explicitly described in this document

This document is the **single source of truth** for planning, execution, and verification.

---

## 2. Execution Environment (Lock First)

Before any planning or implementation begins, confirm:

- [ ] Correct repository and branch (`promptroot`, `main` or feature branch)
- [ ] **Target deployment:** Firebase Hosting / GitHub Pages
- [ ] **Runtime:** Browser (ES6 Modules), Node.js (Firebase Functions)
- [ ] Required services running:
    - Firebase Emulators (`npm start` or `docker-compose up`)
    - Python HTTP Server (for local static file serving: `python -m http.server 3000`)
- [ ] Environment variables present and documented (`firebase.json`, `src/utils/constants.js`)
- [ ] Tooling access verified:
    - `npm` (Node Package Manager)
    - `vitest` (Unit Tests)
    - `playwright` (E2E Tests)

**No implementation proceeds until this section is verified.**

---

## 3. System Context

### Domain Context
**Feature:** {FEATURE_NAME} (TBD)  
**Goal:** {ONE_SENTENCE_GOAL} (TBD)  
**Users:** {USERS_OR_STAKEHOLDERS} (TBD)

### Stack
- **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3 (Modular CSS)
- **Backend:** Firebase Cloud Functions (Node.js 20/22)
- **Database:** Cloud Firestore
- **Jobs/Workflows:** Firebase Functions (Triggers/Scheduled)
- **Integrations:** GitHub API, Jules API (Google), Firebase Auth

### Constraints and Standards
- **Architecture to follow:** 
    - Zero-Build (no bundlers)
    - Page Controller Pattern (`src/pages/*.js`)
    - Modular Architecture (`src/modules/*.js`)
    - Service Worker Caching (`sw.js`)
- **Code conventions:** 
    - ES6 Modules (import/export)
    - No HTML in JS (use `createElement` helpers)
    - CSS Modules (BEM naming)
    - Constants in `src/utils/constants.js`
- **Security/Compliance:** 
    - CSP (Content Security Policy) strict adherence
    - Firestore Security Rules (`config/firestore/firestore.rules`)
    - API Key Encryption (AES-GCM for Jules keys)
- **Forbidden changes:** 
    - Introducing build steps
    - Adding heavy client-side dependencies without Lazy Loading

---

## 4. Desired Behavior (What "Correct" Means)

### Primary Flows (Happy Paths)
{HAPPY_PATHS} (TBD)

### Edge Cases and Failure Modes
{EDGE_CASES} (TBD)

### Business Acceptance Criteria
{BUSINESS_ACCEPTANCE_CRITERIA} (TBD)

### Data Integrity and Audit Requirements
- **Data integrity:** Firestore transactions for multi-document updates; strict typing in Cloud Functions.
- **Audit/logging:** `console.error` for client-side errors (captured by error handler); Cloud Logging for backend functions.

---

## 5. Scope and Timeline

- **Deadline/Timebox:** {TIMEBOX} (TBD)
- **Priorities:** {PRIORITIES} (TBD)

## 5. Phased Roadmap Overview

Execution is broken into **strict, sequential phases**.  
Only one phase may be active at a time.

Each phase must:
- Produce a concrete artifact
- Have explicit acceptance criteria
- Be independently verifiable
- Include specific verification commands where possible

---

## 6. Phase 1: Foundation / Scaffolding

### Goals
*Describe what foundational structure, contracts, and wiring this phase establishes.*

### Tasks
- [ ] Create/Update data models in Firestore (if applicable)
- [ ] Define new constants in `src/utils/constants.js`
- [ ] Create necessary module files in `src/modules/` (empty exports)
- [ ] Create page/component HTML stubs (if applicable)

### Acceptance Criteria
- [ ] Code compiles / runs in browser without errors
- [ ] New modules can be imported
- [ ] Tests for constants/config pass

### Verification Steps
- Inspect `src/utils/constants.js` for new entries
- Verify module imports in browser console

### Completion Gate
**Phase 1 is complete only when all acceptance criteria are met.**

---

## 7. Phase 2: Core Behavior Implementation

### Goals
*Implement the primary business logic to satisfy {HAPPY_PATHS}.*

### Tasks
- [ ] Implement core logic in `src/modules/{feature}.js`
- [ ] Implement UI interactions and event listeners
- [ ] Integrate with Backend/API (if applicable)

### Acceptance Criteria
- [ ] Primary flows work end-to-end
- [ ] UI updates correctly based on state
- [ ] Data is persisted correctly to Firestore

### Verification Steps
```bash
# Run unit tests
npm run test:run -- src/unit-tests/modules/{feature}.test.js
# Manual verification
npm start
```
- Unit tests for core logic
- Manual walkthrough of happy path

### Completion Gate
No new features added beyond scope of this phase.

---

## 8. Phase 3: Edge Cases and Failure Handling

### Goals
*Harden the system against {EDGE_CASES}.*

### Tasks
- [ ] Handle network errors / offline state
- [ ] Handle invalid input / validation errors
- [ ] Implement retry logic (if applicable)

### Acceptance Criteria
- [ ] System fails safely for all {EDGE_CASES}
- [ ] Error messages are user-friendly (`showToast`)
- [ ] No unhandled promise rejections

### Verification Steps
```bash
# Simulate failures
# Run negative tests
```
- Simulated failure scenarios (disconnect network, etc.)
- Negative test cases

---

## 9. Phase 4: Verification and Testing

### Goals
*Prove correctness against {BUSINESS_ACCEPTANCE_CRITERIA}.*

### Test Coverage Expectations
- [ ] Unit tests for pure logic (`src/unit-tests/`)
- [ ] Integration tests for system boundaries
- [ ] End-to-end tests for {HAPPY_PATHS} (`e2e-tests/`)

### Acceptance Criteria
- [ ] All tests pass
- [ ] No skipped or flaky tests
- [ ] CI pipeline is green
- [ ] {BUSINESS_ACCEPTANCE_CRITERIA} verified

### Verification Artifacts
```bash
# Run full test suite
npm run test:all
# Generate coverage report
npm run test:coverage
```
- Test reports and coverage
- Logs and screenshots
- CI pipeline results

---

## 10. Phase 5: Cleanup, Documentation, and Handoff

### Goals
*Make the work maintainable and transfer knowledge.*

### Tasks
- [ ] Remove debug code and temporary workarounds
- [ ] Add inline comments where intent is non-obvious
- [ ] Update README or docs (reflect actual behavior)
- [ ] Document known limitations and future work

### Acceptance Criteria
- [ ] Codebase follows {CODE_CONVENTIONS}
- [ ] Docs match actual behavior
- [ ] No TODOs related to core functionality
- [ ] Handoff notes prepared for stakeholders

---

## 11. Issues and Iteration Log

*Record all issues discovered during execution. Do not delete resolved issues - they provide audit trail.*

### Issue Template
**Issue #1:** [Brief title]  
- **Observed:** [What actually happened]  
- **Expected:** [What should happen per spec]  
- **Resolution:** [How it was fixed]  
- **Verification:** [Tests/commands that prove fix]  
- **Phase:** [Which phase it occurred in]

---

## 12. Final Sign-Off Checklist

- [ ] All phases (6-10) completed in order
- [ ] All acceptance criteria met for every phase
- [ ] All tests passing (unit, integration, e2e)
- [ ] Manual verification performed for {HAPPY_PATHS}
- [ ] {BUSINESS_ACCEPTANCE_CRITERIA} verified
- [ ] {EDGE_CASES} handled and verified
- [ ] Documentation updated
- [ ] Known issues documented in section 11
- [ ] Ready for {DEPLOYMENT_TARGET}

**Only after this checklist is complete is the work considered done.**
```
anyhow
keep it as granular as possible
do not work on coding
focus on this report of 10 tasks
whichs output you format the following way
```
document  := { finding_section } [ testing_section ]

finding_section :=
  "### " title "\n"
  rationale_paragraph "\n"
  { "\n" citation_line }
  "\n"
  task_stub_block "\n"

title := <short text, no trailing period>

rationale_paragraph := <1–3 sentences, plain text>

citation_line :=
  ":codex-file-citation[codex-file-citation]{"
  "line_range_start=" int " "
  "line_range_end=" int " "
  "path=" path " "
  "git_url=\"" url "#L" int "-L" int "\"}"
  
task_stub_block :=
  ":::task-stub{title=\"" task_title "\"}\n"
  step_line
  { "\n" step_line }
  "\n:::" 

step_line := int "." space step_text
```
ps there is no code output
we want an easy copyable plan
composed of at least 10 tasks
in above grammar
output into a markdown file
and/or in an easy copyable way
