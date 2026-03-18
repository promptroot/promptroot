# Versioned SDD Plan - {PLAN_VERSION}

Date: {DATE}

Create a versioned SDD plan to achieve the following:

{FEATURE_REQUEST_TEXT}

Use these optional sections only when selected in Customize.

{{#if INCLUDE_UI_CHANGES}}
## UI Changes

- Document all affected pages, components, and interaction states.
- Include desktop and mobile behavior changes.
- Note accessibility updates (focus order, labels, keyboard behavior).
{{/if}}

{{#if INCLUDE_AGENT_API}}
## Agent API Changes

- Document all new/changed agent endpoints, methods, and payload contracts.
- Include backward compatibility notes and migration requirements.
- Specify error handling and rate-limit expectations.
{{/if}}

{{#if INCLUDE_UNIT_TESTS}}
## Unit Test Plan

- Add/extend unit tests for all changed modules.
- Include positive, negative, and edge-case coverage.
- Confirm no regressions in adjacent modules.
{{/if}}

{{#if INCLUDE_E2E_TESTS}}
## E2E Test Plan

- Add end-to-end coverage for primary flows and critical failure paths.
- Validate behavior across required viewports and auth states.
- Include deterministic fixtures/mocks where needed.
{{/if}}

{{#if INCLUDE_ROLLOUT_PLAN}}
## Rollout and Verification

- Define release steps, observability checks, and rollback strategy.
- Include post-deploy verification checklist.
- Identify ownership for monitoring and incident response.
{{/if}}

## Core Delivery Requirements

- Include version history entries for each implementation milestone.
- Reference concrete files/modules expected to change.
- Provide acceptance criteria and verification commands.
