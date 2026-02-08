# Specification-Driven Execution Roadmap: 10 Granular Tasks

**Generated:** 2026-02-08  
**Repository:** promptroot/promptroot  
**Context:** Zero-Build Vanilla JavaScript SPA with Firebase Backend

---

### Establish Firebase Environment Configuration

Verify the development and production Firebase environments are properly configured before any feature implementation begins. The application uses port-based detection (port 5000 for emulators, port 3000 for production) to determine which Firebase endpoint to use.

:codex-file-citation[codex-file-citation]{line_range_start=46 line_range_end=50 path=src/firebase-init.js git_url="https://github.com/promptroot/promptroot/blob/main/src/firebase-init.js#L46-L50"}

:codex-file-citation[codex-file-citation]{line_range_start=8 line_range_end=15 path=src/firebase-init.js git_url="https://github.com/promptroot/promptroot/blob/main/src/firebase-init.js#L8-L15"}

:::task-stub{title="Configure Firebase Environment Detection"}
1. Run `npm start` and verify app runs on port 3000 with production Firebase
2. Run `docker-compose up --build` and verify app runs on port 5000 with emulators
3. Check `src/firebase-init.js` port detection logic matches requirements
4. Verify Firebase emulator endpoints are correctly configured for development
5. Document environment variables in `firebase.json` and `src/utils/constants.js`
6. Test Firebase authentication state persistence across page refreshes
7. Verify Firestore emulator connection on localhost:8090 in dev mode
:::

---

### Define Feature Constants and Configuration

Add all feature-specific constants to the centralized constants file following the zero-build architecture. All magic strings, timeouts, API endpoints, and configuration must be defined in `src/utils/constants.js` to maintain consistency.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=50 path=src/utils/constants.js git_url="https://github.com/promptroot/promptroot/blob/main/src/utils/constants.js#L1-L50"}

:::task-stub{title="Add Feature Constants to constants.js"}
1. Identify all feature-specific magic strings and values needed
2. Add constants to `src/utils/constants.js` following existing patterns
3. Group constants by category (timeouts, UI text, API endpoints, etc.)
4. Export constants using named exports only (no default exports)
5. Add JSDoc comments for complex constants explaining their purpose
6. Verify all constants use UPPER_SNAKE_CASE naming convention
7. Test that constants can be imported in browser without errors
:::

---

### Create Firestore Data Model and Security Rules

Define Firestore collections, document structure, and security rules before implementing any data persistence logic. All Firestore rules must enforce user-only data access patterns.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=30 path=config/firestore/firestore.rules git_url="https://github.com/promptroot/promptroot/blob/main/config/firestore/firestore.rules#L1-L30"}

:::task-stub{title="Design Firestore Collections and Security Rules"}
1. Document collection structure with example documents in markdown
2. Add new collection paths to `config/firestore/firestore.rules`
3. Implement user-only read/write rules: `request.auth.uid == userId`
4. Add authentication requirement checks for all new collections
5. Create composite indexes in `firestore.indexes.json` if needed
6. Test rules using Firebase emulator UI at http://localhost:4000
7. Verify unauthorized users cannot access other users' data
:::

---

### Scaffold Module Files with Named Exports

Create empty module files in `src/modules/` following the one-feature-per-module pattern. All modules must use named exports only and maintain module-scoped private state.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=20 path=docs/CODE_STYLE_GUIDE.md git_url="https://github.com/promptroot/promptroot/blob/main/docs/CODE_STYLE_GUIDE.md#L1-L20"}

:::task-stub{title="Create Feature Module Scaffolding"}
1. Create module file in `src/modules/{feature-name}.js`
2. Add file header comment describing module purpose
3. Import required dependencies using relative paths
4. Export placeholder functions using named exports: `export function myFunc() {}`
5. Define module-level private state variables using `let` or `const`
6. Test module can be imported in browser console without errors
7. Verify no HTML strings or inline styles exist in the module
:::

---

### Implement DOM Manipulation Using Helper Functions

Build UI components using DOM APIs and helper functions from `src/utils/dom-helpers.js`. Never use innerHTML with HTML strings or inline styles.

:codex-file-citation[codex-file-citation]{line_range_start=40 line_range_end=75 path=docs/CODE_STYLE_GUIDE.md git_url="https://github.com/promptroot/promptroot/blob/main/docs/CODE_STYLE_GUIDE.md#L40-L75"}

:::task-stub{title="Build UI Components with DOM Helpers"}
1. Use `createElement` helper for creating elements with classes
2. Use `clearElement` helper to remove all child nodes
3. Apply CSS classes only, never inline styles (except dynamic positioning)
4. Use BEM naming convention: `.component`, `.component__element`, `.component--modifier`
5. Append elements using `appendChild` or `append` methods
6. Test UI renders correctly in browser DevTools
7. Verify no console errors appear during element creation
:::

---

### Integrate Firebase Authentication State Listener

Set up authentication state management using the existing Firebase service patterns. All auth-dependent features must wait for Firebase to initialize.

:codex-file-citation[codex-file-citation]{line_range_start=15 line_range_end=24 path=src/shared-init.js git_url="https://github.com/promptroot/promptroot/blob/main/src/shared-init.js#L15-L24"}

:::task-stub{title="Setup Authentication State Management"}
1. Import `waitForFirebase` from `src/shared-init.js`
2. Import `getAuth` from `src/modules/firebase-service.js`
3. Wrap auth-dependent code in `waitForFirebase()` callback
4. Use `getAuth()?.currentUser` to check current user state
5. Add `onAuthStateChanged` listener for real-time auth updates
6. Handle user sign-in required errors with ErrorCategory.AUTH
7. Test authentication flow in browser with sign in/out
:::

---

### Implement Session Caching for API Responses

Add session-based caching for API responses using the existing cache manager. Cache policies are defined per resource type in constants.js.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=100 path=src/modules/jules-queue.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/jules-queue.js#L1-L100"}

:::task-stub{title="Implement Session-Based API Caching"}
1. Import `setCache` and `CACHE_KEYS` from `src/utils/session-cache.js`
2. Define cache key in CACHE_KEYS constant object
3. Implement cache-first strategy: check cache before API call
4. Store API responses in sessionStorage using setCache
5. Add TTL (time-to-live) support using cache-manager.js
6. Implement LRU eviction when cache exceeds maxEntries limit
7. Test cache hit/miss behavior in browser DevTools Application tab
:::

---

### Create Page Initialization Module

Build page-specific initialization file in `src/pages/` following the pattern established in PR #218. Each page must wait for shared components before initializing.

:codex-file-citation[codex-file-citation]{line_range_start=8 line_range_end=78 path=docs/CODE_STYLE_GUIDE.md git_url="https://github.com/promptroot/promptroot/blob/main/docs/CODE_STYLE_GUIDE.md#L8-L78"}

:::task-stub{title="Create Page-Specific Initialization File"}
1. Create `src/pages/{page-name}-page.js` file
2. Import `waitForFirebase` from `src/shared-init.js`
3. Create `waitForComponents()` function to check for header element
4. Create `initApp()` function for page-specific setup
5. Add DOMContentLoaded event listener with readyState check
6. Set up event handlers using `onclick` or `addEventListener`
7. Test page loads without errors and initializes correctly
:::

---

### Write Unit Tests with Vitest and jsdom

Create unit tests for pure functions and module logic following existing test patterns. Tests must use jsdom environment and meet coverage thresholds.

:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=48 path=vitest.config.js git_url="https://github.com/promptroot/promptroot/blob/main/vitest.config.js#L1-L48"}

:::task-stub{title="Implement Unit Tests for Module Functions"}
1. Create test file in `src/unit-tests/modules/{feature}.test.js`
2. Import test functions from vitest: `describe`, `it`, `expect`
3. Use `beforeEach` to set up test fixtures and mocks
4. Test pure logic functions with various input/output scenarios
5. Mock Firebase services using patterns from setup.js
6. Run tests with `npm run test:run` and verify all pass
7. Check coverage report meets thresholds: 10% lines, 24% functions
:::

---

### Implement Error Handling with Error Handler Utility

Add comprehensive error handling using the centralized error handler. All errors must be categorized and logged appropriately.

:codex-file-citation[codex-file-citation]{line_range_start=80 line_range_end=96 path=src/modules/jules-queue.js git_url="https://github.com/promptroot/promptroot/blob/main/src/modules/jules-queue.js#L80-L96"}

:::task-stub{title="Add Error Handling with Error Categories"}
1. Import `handleError` and `ErrorCategory` from `src/utils/error-handler.js`
2. Wrap async operations in try-catch blocks
3. Call `handleError(err, { source: 'functionName' })` in catch blocks
4. Specify error category: ErrorCategory.AUTH, NETWORK, or VALIDATION
5. Set toastType for user notifications: 'error', 'warn', or 'info'
6. Test error scenarios by simulating network failures
7. Verify user-friendly error messages appear via toast notifications
:::

---

