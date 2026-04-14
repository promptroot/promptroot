# CLAUDE.md

## Project Overview

PromptRoot is a zero-build, modular single-page application for sharing and managing AI prompts stored as markdown files in GitHub repositories. Key features include:
- Prompt library browser with tree navigation and branch/repo switching
- Jules AI integration (Google's coding assistant) with queue-based batch processing
- Jules session analytics dashboard with usage metrics and history
- Copen (context opener) system for launching prompts in AI tools (Claude, ChatGPT, Gemini, etc.)
- Browser extension (Manifest v3) for web capture with GitHub sync
- GitHub OAuth authentication via Firebase
- Firebase backend for user data, API key encryption, and queue management
- Service worker for offline support and performance (88% faster repeat loads)

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), no build step, no framework
- **Backend**: Firebase Cloud Functions (Node.js 22)
- **Database**: Firebase Cloud Firestore
- **Auth**: GitHub OAuth via Firebase Authentication
- **Libraries**: marked.js (Markdown), DOMPurify (XSS), Fuse.js (search, lazy-loaded), Firebase SDK (CDN)
- **Testing**: Vitest (unit), Playwright (E2E), axe-core (accessibility)
- **Hosting**: Firebase Hosting / GitHub Pages
- **CI/CD**: GitHub Actions (unit tests, smoke tests, E2E tests)

## Project Structure

```
index.html              # Main entry point (prompt browser)
oauth-callback.html     # GitHub OAuth redirect handler
sw.js                   # Service worker (versioned cache strategy)
pages/                  # Page routes (HTML entry points)
  ├── analytics/        # Jules session analytics dashboard
  ├── jules/            # Jules account & API key management
  ├── queue/            # Jules queue batch processing
  ├── sessions/         # Jules session history
  ├── profile/          # User profile
  ├── webcapture/       # Extension download & instructions
  └── privacy/          # Privacy policy (static)
src/
  ├── modules/          # Feature modules (~35 files)
  ├── pages/            # Page initialization modules (9 files)
  ├── utils/            # Shared utilities (~20 files)
  ├── styles/           # CSS modules (base, components, pages)
  ├── unit-tests/       # Vitest unit tests (~49 files)
  ├── tests/            # Integration tests
  ├── app.js            # Main app initialization
  ├── firebase-init.js  # Firebase SDK config & environment detection
  ├── shared-init.js    # Shared page initialization (header, auth, branches)
  ├── sw-register.js    # Service worker registration
  ├── font-init.js      # Font loading
  └── styles.css        # Aggregated CSS imports
functions/              # Firebase Cloud Functions (index.js)
browser-extension/      # Web capture Chrome extension (Manifest v3)
prompts/                # Markdown prompt library (tutorials, templates)
webclips/               # User-synced web captures (per-user folders)
config/                 # Firebase configuration (firestore.rules, storage.rules)
docs/                   # Documentation
e2e-tests/              # Playwright E2E tests (smoke + extended)
scripts/                # Utility scripts
partials/               # Shared HTML partials
```

## Development

### Quick Start
```bash
npm start
# Visit http://localhost:3000 (production Firebase)
```
Note: `npm start` runs a Python HTTP server on port 3000.

### Docker (Full Environment with Emulators)
```bash
docker-compose up --build
# App: http://localhost:5000
# Emulator UI: http://localhost:4000
```

### Environment Detection
The app detects the environment based on the port (configured in `src/firebase-init.js`):
- **Port 5000**: Development mode - uses Firebase emulators (Firestore on localhost:8090, Functions, Auth)
- **Port 3000**: Production mode - connects to production Firebase services

### Cloud Functions
```bash
cd functions && npm install
npm run serve   # Local testing with emulators
npm run deploy  # Deploy to production Firebase
```

### Testing
```bash
npm test                    # Run vitest in watch mode
npm run test:run            # Run unit tests once
npm run test:coverage       # Run with coverage report
npm run test:e2e            # Run all Playwright E2E tests
npm run test:e2e:smoke      # Quick critical-path E2E tests (Chromium)
npm run test:e2e:extended   # Full extended E2E suite
npm run test:all            # Unit tests + smoke E2E tests
```

Unit tests use jsdom environment with setup in `src/unit-tests/setup.js`. Coverage thresholds are configured in `vitest.config.js`. E2E tests use Playwright with Chromium.

## Runtime Behaviors

- **Async Firebase Loading**: Firebase SDK loads asynchronously via CDN; modules use `waitForFirebase()` which retries every 100ms for up to 30 seconds
- **Port-based Config**: `src/firebase-init.js` checks `window.location.port` to determine emulator vs production endpoints
- **Session Caching**: Uses sessionStorage with LRU eviction for API responses; cache policies defined in `constants.js` (cache-first, network-only, stale-while-revalidate)
- **Auth State**: Authentication state persists in localStorage; checked on every page load
- **Service Worker**: Versioned cache (`promptroot-v8-static`) pre-caches ~40 static assets; network-first for GitHub API/raw markdown; excludes Firestore and dynamic data
- **Lazy Loading**: Fuse.js loaded on demand for search functionality
- **Version Checking**: Compares current version (meta tag) against latest GitHub commit; shows update banner if outdated

## Coding Conventions

### Architecture Rules
- **Zero-build**: Plain ES6 modules served directly, no transpilation
- **No HTML in JavaScript**: Use DOM APIs only (createElement, etc.)
- **No inline styles**: CSS files only
- **Named exports only**: No default exports
- **One feature = One module**: Separated concerns

### JavaScript Patterns
- All async operations use async/await
- Module state as private variables (module-scoped `let`/`const`)
- Constants in `src/utils/constants.js` (magic strings, regex, config, UI text, timeouts)
- DOM helpers in `src/utils/dom-helpers.js`
- Error handling via `src/utils/error-handler.js`
- Cache management via `src/utils/cache-manager.js` with TTL support

### CSS Architecture
- Modular CSS imported via `src/styles.css` (28 component/layout imports)
- BEM naming: `.component`, `.component--modifier`, `.component__element`
- CSS variables defined in `src/styles/base.css`
- Component styles in `src/styles/components/`
- Page-specific styles in `src/styles/pages/`

### File Organization
- Page initialization files in `src/pages/[page]-page.js`
- Feature modules in `src/modules/[module-name].js`
- Shared initialization in `src/shared-init.js`
- Firebase config in `src/firebase-init.js`
- Firebase service accessors in `src/modules/firebase-service.js`

## Common Development Workflows

### Creating a New Page
1. Create HTML file in `pages/{page-name}/{page-name}.html`
2. Create initialization module in `src/pages/{page-name}-page.js`
3. Import `shared-init.js` and call `initializeSharedComponents(activePage)`
4. Add page styles in `src/styles/pages/{page-name}.css` if needed
5. Add route to `firebase.json` rewrites if needed

### Creating a New Module
1. Create file in `src/modules/{module-name}.js`
2. Use named exports only (no default exports)
3. Keep module state as private variables
4. Import from other modules as needed

### Adding Styles
1. Create component CSS in `src/styles/components/{component}.css`
2. Add `@import url('./styles/components/{component}.css')` to `src/styles.css`
3. Use BEM naming conventions

### Adding Tests
1. Unit test in `src/unit-tests/modules/{module}.test.js` or `src/unit-tests/utils/{util}.test.js`
2. E2E test in `e2e-tests/e2e/smoke/` (critical paths) or `e2e-tests/e2e/extended/` (full coverage)
3. Setup file at `src/unit-tests/setup.js` configures jsdom and mocks

## Key Modules

### Core Modules (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `auth.js` | GitHub OAuth authentication & auth state management |
| `firebase-service.js` | Firebase service initialization and accessor functions |
| `github-api.js` | GitHub REST API wrapper with session caching |
| `header.js` | Navigation header component, user menu |
| `prompt-renderer.js` | Markdown rendering with DOMPurify sanitization |
| `prompt-list.js` | Sidebar tree navigation, file listing, caching |
| `prompt-service.js` | High-level prompt service layer |
| `prompt-viewer.js` | Prompt viewer/display component |
| `copen.js` | Copen URL resolution and caching for AI tool launchers |
| `copen-manager.js` | Manages user's custom copens in Firestore (CRUD operations) |

### Analytics & Tracking (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `analytics.js` | Calculates and aggregates analytics data from tracked sessions |
| `session-tracking.js` | Tracks Jules sessions in Firestore for analytics and history |

### Jules Integration (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `jules-api.js` | Jules API client (sessions, repositories, branches) |
| `jules-queue.js` | Main queue management UI, batch operations (~64KB, largest module) |
| `jules-queue-service.js` | Service layer for queue operations |
| `jules-queue-store.js` | Queue state store |
| `jules-account.js` | Jules account profile display |
| `jules-keys.js` | API key management (AES-GCM encrypted storage) |
| `jules-modal.js` | Modal dialog for API key entry |
| `jules-free-input.js` | Free-form prompt input for Jules |
| `jules-subtask-modal.js` | Subtask batch viewing/management modal |
| `subtask-manager.js` | Subtask execution and error handling |

### UI Components (`src/modules/`)

| Module | Purpose |
|--------|---------|
| `branch-selector.js` | Branch selection dropdown with favorites and search |
| `repo-branch-selector.js` | Repository and branch selection UI (~37KB) |
| `confirm-modal.js` | Reusable confirmation modal dialog |
| `dropdown.js` | Generic dropdown UI component |
| `split-button.js` | Split button UI component |
| `sidebar.js` | Sidebar toggle and management |
| `folder-submenu.js` | Submenu for folder/file tree navigation |
| `status-bar.js` | Bottom status bar for messages |
| `status-renderer.js` | Status indicator rendering |
| `toast.js` | Toast notification component |

### Utilities (`src/utils/`)

| Utility | Purpose |
|---------|---------|
| `constants.js` | All magic strings, regex, config, UI text, timeouts, cache policies |
| `dom-helpers.js` | DOM manipulation helpers (createElement, clearElement, etc.) |
| `cache-manager.js` | Cache management with TTL support |
| `session-cache.js` | sessionStorage-based caching with LRU eviction |
| `error-handler.js` | Error handling and logging utilities |
| `firestore-helpers.js` | Firestore query and data manipulation helpers |
| `modal-manager.js` | Modal visibility and focus management |
| `icon-helpers.js` | Material icon utilities and definitions |
| `lazy-loaders.js` | Lazy loading for Fuse.js and other libraries |
| `validation.js` | Data validation utilities |
| `url-params.js` | URL parameter parsing and hash management |
| `debounce.js` | Debounce function utility |
| `clipboard.js` | Clipboard copy with fallback |
| `checkbox-helpers.js` | Mutually exclusive checkbox utilities |
| `slug.js` | URL slug utilities |
| `title.js` | Page title utilities |
| `extension-detector.js` | Chrome extension presence detection |
| `copen-config.js` | Dynamic copen options configuration from user settings |
| `handler-registry.js` | Global handler registry for namespaced event management |
| `jules-queue-helpers.js` | Jules queue utilities (date parsing, timezone handling) |

## Database

Firestore collections:
- `julesQueues/{uid}/items` - User's Jules queue items (prompt tasks, batch operations)
- `julesKeys/{uid}` - Encrypted Jules API keys (AES-GCM encryption)
- `juleSessions/{uid}/sessions/{sessionId}` - Tracked Jules session data for analytics
- `juleSessions/{uid}/sessions/{sessionId}/activities/{activityId}` - Session activity details
- `juleSessions/{uid}/analytics/{period}` - Aggregated analytics data
- `users/{uid}` - User preferences (favorites, settings)
- `userProfiles/{uid}` - User profile data (timezone preferences, etc.)
- `userCopens/{uid}` - User's custom copen configurations

Security rules: `config/firestore/firestore.rules`
- Users can only read/write their own documents
- Authentication required for all operations
- Deny-all default for unmatched paths

Indexes: `firestore.indexes.json`

## Key Constants (`src/utils/constants.js`)

- **GitHub config**: `OWNER`, `REPO`, `BRANCH` for default prompt source
- **Jules API**: `JULES_API_BASE` endpoint
- **Tag system**: Auto-tags prompts by keyword (review, bug, design, refactor categories)
- **Cache policies**: Per-resource TTL and strategy (cache-first, network-only, stale-while-revalidate)
- **Cache durations**: session=0 (until refresh), short=5min
- **Timeouts**: statusBar=3s, fetch=5s, toast=3s, uiDelay=500ms, queueDelay=800ms
- **Limits**: firebaseMaxAttempts=300, promptCacheMaxEntries=20, PAGE_SIZES (sessions=10, branches=100)
- **Retry config**: maxRetries=3, baseDelay=1000ms
- **UI text**: All user-facing strings for Jules, queue, and general UI

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `test.yml` - Unit tests on push to main and PRs (vitest with coverage to Codecov)
- `smoke-tests.yml` - Quick critical-path E2E tests on push to any branch and PRs
- `e2e-tests.yml` - Full Playwright E2E suite (manual trigger only; Chromium, Firefox, WebKit)
- `extended-e2e-tests.yml` - Extended integration tests (manual trigger with browser choice)

## Browser Extension

Chrome extension in `browser-extension/` using Manifest v3:
- **Content script** (`content.js`): Extracts markdown from webpages
- **Background** (`background.js`): Service worker for lifecycle and messaging
- **Popup** (`popup.html/js`): Title, filename, preview, download/sync buttons
- **GitHub auth** (`github-auth.js`): OAuth flow for the extension
- **GitHub sync** (`github-sync.js`): Syncs captured content to repository
- Permissions: activeTab, scripting, storage
- Pre-built package: `pr-webcapture.zip`

## Commands

```bash
npm start                           # Python HTTP server on port 3000 (production Firebase)
npm test                            # Unit tests in watch mode
npm run test:run                    # Unit tests once
npm run test:coverage               # Unit tests with coverage
npm run test:e2e                    # Full E2E tests
npm run test:e2e:smoke              # Smoke E2E tests (Chromium)
npm run test:all                    # Unit + smoke E2E
docker-compose up                   # Full dev environment with emulators (port 5000)
cd functions && npm run serve       # Test functions locally
cd functions && npm run deploy      # Deploy functions to Firebase
```

## Important Files

- `src/utils/constants.js` - All magic strings, regex patterns, config, timeouts, cache policies
- `src/firebase-init.js` - Firebase SDK configuration & environment detection
- `src/shared-init.js` - Shared page initialization (header, auth, branches, version check)
- `src/modules/firebase-service.js` - Firebase service accessors (auth, db, functions)
- `sw.js` - Service worker with versioned cache strategy
- `firebase.json` - Firebase hosting, emulator config, CSP headers, rewrites
- `config/firestore/firestore.rules` - Firestore security rules
- `vitest.config.js` - Unit test configuration with coverage thresholds
- `playwright.config.js` - E2E test configuration

## Dev history wiki

SDDs live in `docs/sdd/*.md` and are browsable at `/wiki`. A project-scoped
skill at `.claude/skills/search-dev-history/SKILL.md` queries the RAG
endpoint for historical context. Use it before proposing non-trivial
architectural changes or when the user references a past decision. See
`AGENTS.md` for the contract.

## Documentation

- `docs/CODE_STYLE_GUIDE.md` - JavaScript/CSS coding standards
- `docs/UI_GUIDELINES.md` - UI/UX design patterns and component guidelines
- `docs/DOCKER.md` - Docker and emulator setup
- `docs/SECURITY.md` - Security considerations, encryption, CSP
- `docs/SESSION_TRACKING.md` - Session tracking implementation guide
- `FORKING_GUIDE.md` - Guide for forking the repository
- `UNIT_TESTS.md` - Unit testing documentation
