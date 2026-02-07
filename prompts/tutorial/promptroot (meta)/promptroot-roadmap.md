# PromptRoot Development Roadmap

## Inputs (Parameters)

### Project / Feature Name
PromptRoot

### One-Sentence Goal
Enable teams to share, organize, and execute AI prompts through a zero-build web interface backed by GitHub and Firebase.

### Users / Stakeholders
- Development teams using AI coding assistants
- AI practitioners and prompt engineers
- Technical writers managing prompt libraries
- Open source contributors

### Target Environment
- **OS/runtime:** Modern browsers (Chrome, Firefox, Safari, Edge) with ES6 module support
- **Execution model:** Client-side SPA served from GitHub Pages (static hosting)
- **Deployment:** GitHub Pages (auto-deploy from main branch), Firebase Cloud Functions (Node.js 22)

### Stack
- **Frontend:** Vanilla JavaScript (ES6 modules), HTML5, CSS3 (BEM methodology)
- **Backend:** Firebase Cloud Functions (Node.js 22), GitHub REST API
- **Database:** Firestore (NoSQL), sessionStorage (client-side caching)
- **Background jobs / workflows:** Jules task queue system (Firestore-backed), GitHub Actions CI
- **External integrations:** GitHub REST API, Google Jules API, DOMPurify CDN, marked.js CDN

### Repo Constraints
- **Existing architecture to follow:** Zero-build philosophy (no transpilation, bundlers, or frameworks), ES6 modules with named exports only, file type segregation (HTML/CSS/JS separate)
- **Code style / conventions:** BEM CSS naming, all constants in `src/utils/constants.js`, all DOM helpers in `src/utils/dom-helpers.js`, async/await only, relative imports with `.js` extension
- **Forbidden changes / non-goals:** Build tools, transpilation, bundlers, default exports, inline HTML/CSS in JavaScript, frontend npm dependencies, global variables

### Data and Correctness Requirements
- **Data integrity expectations:** Firestore rules enforce user-only data access, queue items maintain execution order, API keys encrypted (AES-GCM) before storage
- **Auditability/logging requirements:** Cloud Functions log all API calls with timestamps, error tracking via console.error, rate limit info tracked and displayed
- **Security/compliance constraints:** XSS protection via DOMPurify, HTTPS-only API calls, no secrets in client code, GitHub OAuth authentication

### Primary Flows (Happy Paths)
1. Browse prompts from GitHub repository with tree navigation and deep linking
2. Render markdown with syntax highlighting and XSS sanitization
3. Authenticate with GitHub OAuth and send prompts to Jules API
4. Queue multiple subtasks for batch processing with Jules
5. Capture webpages as markdown via browser extension and sync to GitHub

### Edge Cases / Failure Modes
- GitHub API rate limiting (5000/hour)
- Firebase authentication failures
- Jules API errors and network failures
- Cache staleness (15-minute TTL)
- Malicious markdown content (XSS payloads)
- Browser extension OAuth failures

### Acceptance Criteria (Business Level)
- Zero-build constraint maintained (no transpilation)
- Sub-second page load (<1s cached, <200ms render)
- XSS protection verified with test suite
- Mobile responsive with touch-friendly controls
- GitHub sync within cache TTL (15 min)
- Jules integration >95% success rate
- Fuzzy search <300ms for 100+ prompts

### Time / Scope Constraints
- **Deadline or timebox:** Ongoing maintenance and feature development
- **Must-have vs nice-to-have:** Security, zero-build philosophy, core browsing (must-have); advanced scheduling, analytics (nice-to-have)

---

## 0. Clarifications and Assumptions

**Stated Assumptions:**
- Current production system is stable and hosted on GitHub Pages
- Firebase backend (Firestore, Cloud Functions) is operational
- Jules API integration is functional for existing users
- Docker development environment is available but optional
- Security and zero-build architecture must be preserved

---

## 1. Purpose and Scope

**Objective:** Maintain and enhance PromptRoot as a zero-build web application for managing and sharing AI prompts as markdown files in GitHub repositories, with deep Jules API integration.

**In Scope:**  
- Zero-build vanilla JavaScript SPA serving prompts from GitHub
- Firebase backend for user data, API keys, and queue management
- Jules API integration for sending prompts to Google's coding assistant
- Browser extension for web capture and markdown sync
- Session management and task queue for batch processing
- GitHub OAuth authentication
- XSS protection and secure markdown rendering

**Out of Scope / Non-Goals:**  
- Build tools, transpilers, bundlers, or frameworks
- Default exports or non-modular code patterns
- Inline HTML strings or inline CSS in JavaScript
- Any npm packages in frontend code (backend Functions only)
- Features that compromise the zero-build philosophy

This document is the **single source of truth** for planning, execution, and verification.

---

## 2. Execution Environment (Lock First)

Before any planning or implementation begins, confirm:

- [x] Correct repository: promptroot/promptroot on GitHub
- [x] Primary branch: `main`
- [x] **Target deployment:** GitHub Pages (static hosting)
- [x] **Runtime:** Modern browsers (ES6 module support required)
- [x] **Local development:** Python HTTP server (port 3000) OR Docker Compose (port 5000)
- [x] Firebase services running (Firestore, Cloud Functions, Authentication)
- [x] Required environment variables documented in `.env.example` (for Cloud Functions)
- [x] Testing via browser DevTools console verification
- [x] CI/CD: GitHub Actions for automated tests

**No implementation proceeds until this section is verified.**

---

## 3. System Context

### Domain Context
**Feature:** PromptRoot - AI Prompt Library & Jules Integration  
**Goal:** Enable teams to share, organize, and execute AI prompts through a zero-build web interface backed by GitHub and Firebase  
**Users:** Development teams, AI practitioners, technical writers, prompt engineers

### Stack
- **Frontend:** Vanilla JavaScript (ES6 modules), HTML5, CSS3 (BEM methodology)
- **Backend:** Firebase Cloud Functions (Node.js 22), GitHub REST API
- **Database:** Firestore (NoSQL), sessionStorage (client-side caching)
- **Jobs/Workflows:** Jules task queue system (Firestore-backed), GitHub Actions CI
- **Integrations:** 
  - GitHub REST API (repository contents, branches, authentication)
  - Google Jules API (sessions, activities, sources)
  - DOMPurify CDN (XSS protection)
  - marked.js CDN (Markdown rendering)

### Constraints and Standards
- **Architecture to follow:** 
  - Zero-build philosophy: NO transpilation, bundlers, or frameworks
  - Modular ES6: Named exports only, one feature per module
  - File type segregation: HTML, CSS, JavaScript in separate files
  - Page initialization pattern: Dedicated `src/pages/{name}-page.js` files
  
- **Code conventions:** 
  - All constants in `src/utils/constants.js`
  - All DOM helpers in `src/utils/dom-helpers.js`
  - BEM CSS naming: `.component`, `.component__element`, `.component--modifier`
  - Async/await only (no callbacks or raw promises)
  - Relative imports with `.js` extension
  
- **Security/Compliance:** 
  - XSS protection via DOMPurify sanitization
  - Firestore security rules enforce user-only data access
  - AES-GCM encryption for Jules API keys before storage
  - HTTPS-only API calls and hosting
  - No secrets in client code
  
- **Forbidden changes:** 
  - Adding build tools or transpilation
  - Using default exports
  - Inline HTML strings or inline CSS in JavaScript
  - Frontend npm dependencies (Functions can use npm)
  - Global variables

---

## 4. Desired Behavior (What "Correct" Means)

### Primary Flows (Happy Paths)

**Flow 1: Browse and View Prompts**
1. User visits promptroot.github.io/promptroot
2. System loads prompt list from GitHub via Contents API
3. Prompts rendered in sidebar tree structure with folder hierarchy
4. User clicks prompt → markdown rendered with syntax highlighting and sanitization
5. Deep links work: `#p=folder/prompt-slug` loads specific prompt

**Flow 2: Jules Integration**
1. Authenticated user clicks "Try in Jules" on a prompt
2. Modal opens with Jules account selection
3. User selects source (selected file context) and sends prompt
4. System creates Jules session via API
5. User redirected to Jules session link
6. Session appears in user's session history

**Flow 3: Queue Management**
1. User opens Queue page
2. User adds multiple subtasks with context
3. User schedules queue execution time
4. System processes queue items sequentially
5. Each item creates Jules session and tracks completion
6. User views results and session links

**Flow 4: Web Capture (Browser Extension)**
1. User installs Chrome extension
2. User navigates to webpage
3. User clicks extension → "Capture as Markdown"
4. Extension converts page to markdown
5. User authenticates with GitHub OAuth
6. Markdown synced to `webclips/{username}/` branch
7. File appears in PromptRoot sidebar under web-captures branch

### Edge Cases and Failure Modes

**GitHub API Rate Limiting**
- System checks rate limit headers on every response
- Shows warning when remaining < 10 requests
- Falls back to Tree API when Contents API exhausted
- Implements request coalescing to prevent duplicate calls

**Firebase Authentication Failure**
- Graceful degradation: browsing works without auth
- Clear error messages for auth issues
- Jules features hidden if not authenticated

**Jules API Errors**
- Network failures show user-friendly error messages
- Encrypted API keys remain secure on error
- Queue continues processing on single-item failure

**Cache Staleness**
- 15-minute sessionStorage TTL for prompt lists
- Background refresh for stale cache
- Manual cache clear on branch switch

**Malicious Markdown Content**
- DOMPurify sanitization blocks XSS payloads
- Fallback to textContent if DOMPurify fails to load
- Test suite validates XSS protection

### Business Acceptance Criteria

1. **Zero-build constraint maintained**: All code runs natively in browser without transpilation
2. **Sub-second load time**: Initial page load < 1 second (cached), prompt rendering < 200ms
3. **XSS protection verified**: Test suite confirms all dangerous HTML is sanitized
4. **Mobile responsive**: Sidebar toggles on mobile, touch-friendly controls
5. **GitHub sync reliability**: Prompts reflect main branch within cache TTL (15 min)
6. **Jules integration success**: >95% of Jules submissions create valid sessions
7. **Search performance**: Fuzzy search returns results < 300ms for 100+ prompts
8. **Accessibility**: Keyboard navigation works for all core features

### Data Integrity and Audit Requirements

- **Data integrity:** 
  - Firestore rules prevent cross-user data access
  - Queue items maintain order and execution state
  - Session history preserves chronological order
  - API keys encrypted before storage, never exposed in logs
  
- **Audit/logging:** 
  - Cloud Functions log all API calls with timestamps
  - Error tracking via console.error for client issues
  - Rate limit info tracked and displayed to users
  - Session activity tracked in Firestore with metadata

---

## 5. Scope and Timeline

- **Deadline/Timebox:** Ongoing maintenance and feature development
- **Priorities:** 
  - **Must-have:** Security, zero-build philosophy, XSS protection, core prompt browsing
  - **Should-have:** Jules integration, queue system, branch switching, search
  - **Nice-to-have:** Analytics, advanced queue scheduling, prompt templates

---

## 6. Phased Roadmap Overview

Execution is broken into **strict, sequential phases** for any new feature work.  
Only one phase may be active at a time.

Each phase must:
- Produce a concrete artifact
- Have explicit acceptance criteria
- Be independently verifiable
- Include specific verification commands where possible

---

## 7. Phase 1: Foundation / Scaffolding

### Goals
For new features: Establish module structure, constants, and basic wiring without business logic.

### Tasks
- [ ] Create new module file in `src/modules/{feature}.js` with named exports
- [ ] Add required constants to `src/utils/constants.js`
- [ ] Add DOM helper functions to `src/utils/dom-helpers.js` if needed
- [ ] Create page initialization file in `src/pages/{feature}-page.js` if new page
- [ ] Create HTML template in `pages/{feature}/{feature}.html` with shared-init.js import
- [ ] Add CSS module in `src/styles/components/{feature}.css` and import in `src/styles.css`
- [ ] Wire up event listeners using DOM helpers (no inline handlers)

### Acceptance Criteria
- [ ] Module exports/imports resolve without errors
- [ ] Page loads without console errors
- [ ] DevTools shows no 404s for resources
- [ ] HTML validates (no inline scripts/styles)
- [ ] CSS follows BEM naming convention

### Verification Steps
```bash
# Start local server
npm start

# Open http://localhost:3000 in browser
# Press F12 and check console for errors
# Verify Network tab shows 200s for all resources
```

### Completion Gate
**Phase 1 is complete only when all acceptance criteria are met and basic structure exists without errors.**

---

## 8. Phase 2: Core Behavior Implementation

### Goals
Implement primary business logic for happy paths. For PromptRoot features: prompt loading, rendering, Jules submission, queue processing.

### Tasks
- [ ] Implement data fetching from GitHub API or Firebase
- [ ] Add caching logic with sessionStorage and TTL
- [ ] Implement core UI interactions (clicks, form submission)
- [ ] Add async/await error handling with try/catch
- [ ] Update rate limit tracking if using GitHub API
- [ ] Implement DOMPurify sanitization for any rendered content

### Acceptance Criteria
- [ ] Happy path flows complete end-to-end
- [ ] User sees expected results in UI
- [ ] Data persists correctly (Firestore or localStorage)
- [ ] No unhandled promise rejections
- [ ] Loading states show during async operations

### Verification Steps
```bash
# Manual testing in browser:
# 1. Test primary user flow
# 2. Check Network tab for API calls
# 3. Verify Application > Storage shows cached data
# 4. Test with and without authentication
# 5. Check Firestore console for data writes
```

### Completion Gate
No new features added beyond scope of this phase. All happy paths working.

---

## 9. Phase 3: Edge Cases and Failure Handling

### Goals
Harden system against rate limits, auth failures, network errors, malicious input.

### Tasks
- [ ] Add rate limit checking and warnings for GitHub API calls
- [ ] Implement graceful degradation for unauthenticated users
- [ ] Add network error retry logic with exponential backoff
- [ ] Test XSS payloads and verify sanitization
- [ ] Add cache invalidation on 304/404 responses
- [ ] Implement request coalescing for duplicate in-flight requests
- [ ] Add user-friendly error messages (no raw exceptions)

### Acceptance Criteria
- [ ] System remains functional when rate limited
- [ ] Auth failures don't break page rendering
- [ ] Network errors show clear messages to user
- [ ] All XSS test payloads are sanitized
- [ ] Cache invalidates correctly on errors

### Verification Steps
```bash
# Test rate limiting:
# - Exhaust GitHub API quota (5000 requests/hour)
# - Verify warning appears at < 10 remaining

# Test XSS protection:
# - Create prompt with <script>alert('XSS')</script>
# - Verify sanitized output in DevTools

# Test network errors:
# - Throttle connection in DevTools
# - Verify error messages appear

# Test auth failure:
# - Clear Firebase auth token
# - Verify graceful degradation
```

---

## 10. Phase 4: Verification and Testing

### Goals
Prove correctness against business acceptance criteria. Add automated tests where possible.

### Test Coverage Expectations
- [ ] Unit tests (Vitest) for utilities (slug.js, validation.js, dom-helpers.js)
- [ ] Integration tests (Vitest) for API modules (github-api.js, jules-api.js)
- [ ] E2E tests (Playwright) for smoke tests (authentication, prompt loading, navigation)
- [ ] E2E tests (Playwright) for extended scenarios (Jules submission, queue management, web capture)
- [ ] Manual verification of UI flows
- [ ] XSS test suite with known payloads
- [ ] Performance testing (load time, render time)
- [ ] Accessibility testing (axe-core integration in Playwright)

### Acceptance Criteria
- [ ] All Vitest unit/integration tests pass: `npm test`
- [ ] All Playwright e2e smoke tests pass: `npm run test:e2e:smoke`
- [ ] All Playwright e2e extended tests pass: `npm run test:e2e:extended`
- [ ] No console errors during manual testing
- [ ] XSS protection verified with test prompts
- [ ] Performance metrics within targets (<1s load, <200ms render)
- [ ] Mobile responsive verified on actual device
- [ ] Accessibility audit passes (no critical violations)

### Verification Artifacts
```bash
# Run unit/integration tests
npm test

# Run tests with coverage
npm run test:coverage

# Run e2e smoke tests (fast, critical paths)
npm run test:e2e:smoke

# Run e2e extended tests (full scenarios)
npm run test:e2e:extended

# Run all tests (unit + e2e smoke)
npm run test:all

# Debug e2e tests with UI
npm run test:e2e:ui

# View e2e test report
npm run test:e2e:report

# Check for console errors during manual flows
# Performance: DevTools > Lighthouse audit

# Manual checklist:
# - Test on Chrome, Firefox, Safari
# - Test on mobile device
# - Test with slow 3G throttling
# - Test with ad blockers enabled
```

---

## 11. Phase 5: Cleanup, Documentation, and Handoff

### Goals
Make the work maintainable and ensure code quality.

### Tasks
- [ ] Remove debug console.log statements (keep console.error for errors)
- [ ] Add JSDoc comments for public functions
- [ ] Update README.md if feature changes user-facing behavior
- [ ] Update COPILOT_INSTRUCTIONS.md if architecture changes
- [ ] Update CODE_STYLE_GUIDE.md if new patterns introduced
- [ ] Remove any temporary workarounds or TODOs
- [ ] Verify BEM CSS naming conventions followed
- [ ] Run final manual test of all affected flows

### Acceptance Criteria
- [ ] No debug logs in production code
- [ ] Public functions have JSDoc comments
- [ ] Documentation matches actual behavior
- [ ] No FIXME or TODO comments for core functionality
- [ ] CSS follows BEM conventions consistently

### Documentation Checklist
- [ ] README.md updated with new features
- [ ] COPILOT_INSTRUCTIONS.md reflects architecture
- [ ] CODE_STYLE_GUIDE.md shows examples if new patterns
- [ ] SECURITY.md updated if security implications
- [ ] Inline comments explain non-obvious logic only

---

## 12. Issues and Iteration Log

*Record all issues discovered during execution. Do not delete resolved issues - they provide audit trail.*

### Issue #1: Session Cache Prevents New Prompts from Appearing
- **Observed:** New prompts pushed to main branch don't appear on website after hard refresh
- **Expected:** New prompts should appear within 15 minutes (cache TTL)
- **Root Cause:** Hard refresh clears HTTP cache but not sessionStorage
- **Resolution:** User must clear sessionStorage manually or close all tabs
- **Future Enhancement:** Add manual "Refresh Prompts" button to UI
- **Verification:** Clear sessionStorage, refresh page, new prompt appears
- **Phase:** Maintenance / User Support

---

## 13. Final Sign-Off Checklist

For each feature release or major update:

- [ ] All phases (7-11) completed in order
- [ ] All acceptance criteria met for every phase
- [ ] All unit tests passing: `npm test`
- [ ] All e2e smoke tests passing: `npm run test:e2e:smoke`
- [ ] All e2e extended tests passing: `npm run test:e2e:extended`
- [ ] Manual verification performed for primary flows
- [ ] XSS protection verified with test payloads
- [ ] GitHub API rate limiting handled gracefully
- [ ] Jules integration creates valid sessions
- [ ] Browser extension syncs markdown correctly
- [ ] Documentation updated (README, style guides, security docs)
- [ ] Known issues documented in section 12
- [ ] Mobile responsive tested on device
- [ ] Performance within targets (<1s load, <200ms render)
- [ ] Firestore security rules tested
- [ ] No build tools or transpilation introduced
- [ ] Zero-build philosophy maintained
- [ ] Ready for GitHub Pages deployment

**Only after this checklist is complete is the work considered done.**

---

## Development Commands Reference

```bash
# Local development
npm start                              # Start Python HTTP server on port 3000
open http://localhost:3000             # Open in browser

# Docker development (with emulators)
docker-compose up --build              # Start with Firebase emulators
open http://localhost:5000             # App
open http://localhost:4000             # Emulator UI

# Testing
npm test                               # Run Vitest unit tests
npm run test:coverage                  # Generate coverage report
npm run test:e2e                       # Run all Playwright e2e tests
npm run test:e2e:smoke                 # Run smoke tests only (fast)
npm run test:e2e:extended              # Run extended e2e tests
npm run test:e2e:ui                    # Run e2e tests with Playwright UI
npm run test:e2e:debug                 # Debug e2e tests
npm run test:e2e:report                # View e2e test report
npm run test:all                       # Run unit tests + e2e smoke tests

# Firebase Functions
cd functions
npm install                            # Install dependencies
npm run serve                          # Test with emulators
npm run deploy                         # Deploy to production

# Git workflow
git checkout -b feature/my-feature     # Create feature branch
git add .
git commit -m "feat: description"
git push origin feature/my-feature
# Create PR, get review, merge to main
# GitHub Pages auto-deploys from main
```

---

## Architecture Principles (Critical)

These principles are non-negotiable and define the PromptRoot approach:

1. **Zero-Build**: No transpilation, bundlers, or build steps ever
2. **Named Exports**: NEVER use default exports
3. **File Segregation**: HTML, CSS, JavaScript in separate files only
4. **No Inline Anything**: No inline scripts, styles, or HTML strings
5. **Module State**: Private variables, explicit imports/exports
6. **Async/Await**: No callbacks or raw promises
7. **Security First**: XSS protection, encryption, HTTPS only
8. **User Data Isolation**: Firestore rules enforce per-user access
9. **Graceful Degradation**: Core features work without auth
10. **Manual Testing**: DevTools console verification required before commits
