# Roadmap Generator Prompt (Spec-Driven, Testable Phases)

> **Note:** This prompt uses variable substitution. When you click "Try in Jules", you'll be prompted to fill in values for all the `{PLACEHOLDER}` variables below.

You are an expert software engineer operating in a verification-first, spec-driven workflow.
Your job is to generate a phased implementation roadmap that is maximally testable, low-risk, and auditable.

## Inputs (Parameters)

### Project / Feature Name
{FEATURE_NAME}

### One-Sentence Goal
{ONE_SENTENCE_GOAL}

### Users / Stakeholders
{USERS_OR_STAKEHOLDERS}

### Target Environment
- OS/runtime: {OS_RUNTIME}
- Execution model: {LOCAL_CONTAINER_VM_CI}
- Deployment: {DEPLOYMENT_TARGET}

### Stack
- Frontend: {FRONTEND_STACK}
- Backend: {BACKEND_STACK}
- Database: {DATABASE_STACK}
- Background jobs / workflows: {JOBS_STACK}
- External integrations: {INTEGRATIONS}

### Repo Constraints
- Existing architecture to follow: {ARCH_CONSTRAINTS}
- Code style / conventions: {CODE_CONVENTIONS}
- Forbidden changes / non-goals: {NON_GOALS}
- Relevant documentation: {DOCUMENTATION}

### Data and Correctness Requirements
- Data integrity expectations: {DATA_INTEGRITY_RULES}
- Auditability/logging requirements: {AUDIT_REQUIREMENTS}
- Security/compliance constraints: {SECURITY_COMPLIANCE}

### Primary Flows (Happy Paths)
{HAPPY_PATHS}

### Edge Cases / Failure Modes
{EDGE_CASES}

### Acceptance Criteria (Business Level)
{BUSINESS_ACCEPTANCE_CRITERIA}

### Time / Scope Constraints
- Deadline or timebox: {TIMEBOX}
- Must-have vs nice-to-have: {PRIORITIES}

---

## Task

Generate a roadmap in the following format:

1. **Execution Environment Lock**
2. **Phased Roadmap** with strict sequencing:
   - Phase 1: Foundation / scaffolding
   - Phase 2: Core behavior
   - Phase 3: Edge cases and failure handling
   - Phase 4: Verification and tests
   - Phase 5: Cleanup and documentation

Each phase MUST include:
- Goals
- Task checklist
- Explicit acceptance criteria
- Verification steps (commands to run where possible)
- Completion gate (what must be true before advancing)

## Parallelism Rules

If parallel work is possible, describe it explicitly as:
- Agent A: {area}
- Agent B: {area}
- Agent C: {area}

But still keep the phases sequential. Parallelism can only occur *within* a phase.

## Output Rules (Critical)

- Produce the roadmap as Markdown only.
- Be concrete and testable.
- Prefer small PR-sized chunks.
- Assume AI-written code must be verified: emphasize tests and observable behavior.
- Do NOT invent tools or repo files that are not implied by the inputs.
- If any input is missing or ambiguous, list the minimum set of clarifying questions at the top, then provide a best-effort roadmap with stated assumptions.

## Output Format

Use the template structure below to generate the roadmap. Save output to: `20_ROADMAP_OUTPUT.md`

---
---

# TEMPLATE: Specification-Driven Execution Roadmap

**Instructions:** Fill in ALL sections below using the inputs provided above. Replace placeholder text with specific, actionable content.

## 0. Clarifications and Assumptions

**If any required inputs are missing or ambiguous, list clarifying questions here:**
- [ ] Question 1...
- [ ] Question 2...

**Stated Assumptions (if proceeding without complete inputs):**
- Assumption 1...
- Assumption 2...

*Remove this section if all inputs are complete.*

---

## 1. Purpose and Scope

**Objective:** {ONE_SENTENCE_GOAL}

**In Scope:**  
- {List specific features and behaviors from inputs}

**Out of Scope / Non-Goals:**  
- {NON_GOALS}
- Anything not explicitly described in this document

This document is the **single source of truth** for planning, execution, and verification.

---

## 2. Execution Environment (Lock First)

Before any planning or implementation begins, confirm:

- [ ] Correct repository and branch
- [ ] **Target deployment:** {DEPLOYMENT_TARGET}
- [ ] **Runtime:** {OS_RUNTIME} ({LOCAL_CONTAINER_VM_CI})
- [ ] Required services running (DB, queues, APIs from stack above)
- [ ] Environment variables present and documented
- [ ] Tooling access verified (CI, test runners, AI tools)

**No implementation proceeds until this section is verified.**

---

## 3. System Context

### Domain Context
**Feature:** {FEATURE_NAME}  
**Goal:** {ONE_SENTENCE_GOAL}  
**Users:** {USERS_OR_STAKEHOLDERS}

### Stack
- **Frontend:** {FRONTEND_STACK}
- **Backend:** {BACKEND_STACK}
- **Database:** {DATABASE_STACK}
- **Jobs/Workflows:** {JOBS_STACK}
- **Integrations:** {INTEGRATIONS}

### Constraints and Standards
- **Architecture to follow:** {ARCH_CONSTRAINTS}
- **Code conventions:** {CODE_CONVENTIONS}
- **Security/Compliance:** {SECURITY_COMPLIANCE}
- **Forbidden changes:** {NON_GOALS}
- **Reference documentation:** {DOCUMENTATION}

---

## 4. Desired Behavior (What "Correct" Means)

### Primary Flows (Happy Paths)
{HAPPY_PATHS}

### Edge Cases and Failure Modes
{EDGE_CASES}

### Business Acceptance Criteria
{BUSINESS_ACCEPTANCE_CRITERIA}

### Data Integrity and Audit Requirements
- **Data integrity:** {DATA_INTEGRITY_RULES}
- **Audit/logging:** {AUDIT_REQUIREMENTS}

---

## 5. Scope and Timeline

- **Deadline/Timebox:** {TIMEBOX}
- **Priorities:** {PRIORITIES}

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
- [ ] [Specific task with file/function names]
- [ ] [Specific task with file/function names]
- [ ] [Specific task with file/function names]

### Acceptance Criteria
- [ ] Code compiles / runs
- [ ] Baseline tests pass
- [ ] No placeholder logic remains
- [ ] Logs show expected startup behavior

### Verification Steps
- How to manually verify
- Tests that must pass
- Outputs or artifacts to inspect

### Completion Gate
**Phase 1 is complete only when all acceptance criteria are met.**

---

## 8. Phase 2: Core Behavior Implementation

### Goals
*Implement the primary business logic to satisfy {HAPPY_PATHS}.*

### Tasks
- [ ] [Specific task with file/function names]
- [ ] [Specific task with file/function names]
- [ ] [Specific task with file/function names]

### Acceptance Criteria
- [ ] Primary flows work end-to-end
- [ ] Error handling behaves as specified
- [ ] State transitions are correct and observable

### Verification Steps
```bash
# Run tests
npm test -- [specific test file]
# Manual verification
```
- Unit tests for core logic
- Integration tests for system boundaries
- Manual walkthrough of happy path

### Completion Gate
No new features added beyond scope of this phase.

---

## 9. Phase 3: Edge Cases and Failure Handling

### Goals
*Harden the system against {EDGE_CASES}.*

### Tasks
- [ ] [Specific edge case with file/function]
- [ ] [Retry/rollback logic with file/function]
- [ ] [Idempotency guarantees with file/function]

### Acceptance Criteria
- [ ] System fails safely for all {EDGE_CASES}
- [ ] No data corruption under failure conditions
- [ ] All errors are logged per {AUDIT_REQUIREMENTS}

### Verification Steps
```bash
# Simulate failures
# Run negative tests
```
- Simulated failure scenarios
- Negative test cases
- Log inspection for error traces

---

## 10. Phase 4: Verification and Testing

### Goals
*Prove correctness against {BUSINESS_ACCEPTANCE_CRITERIA}.*

### Test Coverage Expectations
- [ ] Unit tests for pure logic
- [ ] Integration tests for system boundaries
- [ ] End-to-end tests for {HAPPY_PATHS}

### Acceptance Criteria
- [ ] All tests pass
- [ ] No skipped or flaky tests
- [ ] CI pipeline is green
- [ ] {BUSINESS_ACCEPTANCE_CRITERIA} verified

### Verification Artifacts
```bash
# Run full test suite
npm test
# Generate coverage report
npm run coverage
```
- Test reports and coverage
- Logs and screenshots
- CI pipeline results

---

## 11. Phase 5: Cleanup, Documentation, and Handoff

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

## 12. Issues and Iteration Log

*Record all issues discovered during execution. Do not delete resolved issues - they provide audit trail.*

### Issue Template
**Issue #1:** [Brief title]  
- **Observed:** [What actually happened]  
- **Expected:** [What should happen per spec]  
- **Resolution:** [How it was fixed]  
- **Verification:** [Tests/commands that prove fix]  
- **Phase:** [Which phase it occurred in]

---

## 13. Final Sign-Off Checklist

- [ ] All phases (7-11) completed in order
- [ ] All acceptance criteria met for every phase
- [ ] All tests passing (unit, integration, e2e)
- [ ] Manual verification performed for {HAPPY_PATHS}
- [ ] {BUSINESS_ACCEPTANCE_CRITERIA} verified
- [ ] {EDGE_CASES} handled and verified
- [ ] Documentation updated
- [ ] Known issues documented in section 12
- [ ] Ready for {DEPLOYMENT_TARGET}

**Only after this checklist is complete is the work considered done.**
