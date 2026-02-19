This is a zero-build, vanilla JavaScript single-page application for managing and sharing AI prompts stored as markdown files in GitHub repositories. The application uses Firebase for backend services (Firestore database, Cloud Functions, GitHub OAuth authentication). No build tools, transpilers, or frameworks are used - all code runs directly in modern browsers.

## Code Standards

### Required Before Each Commit
- Test locally: Run `npm start` and verify no console errors in browser DevTools
- For Firebase Functions: `cd functions && npm run serve` to test with emulators
- Manually test affected features in browser
- Verify Firebase authentication if auth-related changes
- Check that no build artifacts (node_modules, etc.) are committed

### Development Flow
- **Local dev**: `npm start` (Python HTTP server on port 3000, uses production Firebase)
- **Docker dev**: `docker-compose up --build` (port 5000, uses Firebase emulators)
- **Functions**: `cd functions && npm install`, `npm run serve` (test), `npm run deploy` (production)

### Testing
- No automated test suite - manual testing in browser required
- Open browser DevTools console and verify no errors
- Test authentication flows if modifying auth-related code
- For Functions: check emulator UI at http://localhost:4000

## Architectural Constraints

### Zero-Build Philosophy (Critical)
- NO transpilation, NO build step, NO bundlers
- Plain ES6 modules served directly to browser
- All JavaScript must be compatible with modern browsers without compilation
- Use CDN-loaded libraries only (Firebase SDK, marked.js loaded via script tags in HTML)
- NO npm packages in frontend code (backend Functions can use npm)

### Module Patterns (Strict)
- **Named exports only** - NEVER use default exports
- **One feature per module** - strict separation of concerns
- **No HTML in JavaScript** - use DOM APIs (createElement, appendChild) only
- **No inline styles** - use CSS classes only (except dynamic positioning/visibility)
- **Module state as private variables** - encapsulate within module scope

### JavaScript Requirements
- Use async/await for all asynchronous operations (no callbacks or raw promises)
- All constants must be in `src/utils/constants.js`
- All DOM helpers must be in `src/utils/dom-helpers.js`
- Use sessionStorage for caching API responses
- Always use relative paths for imports: `import { auth } from './auth.js'`

### CSS Requirements
- BEM naming convention: `.component`, `.component--modifier`, `.component__element`
- All styles in CSS files, imported via `src/styles.css`
- Use CSS variables from `src/styles/base.css`
- Component styles in `src/styles/components/`
- Page-specific styles in `src/styles/pages/`

## Repository Structure

```
pages/{page}/{page}.html    # Page routes (HTML entry points)
src/
  ├── modules/               # Feature modules (auth, APIs, UI components)
  │   ├── auth.js           # GitHub OAuth & auth state management
  │   ├── github-api.js     # GitHub REST API wrapper
  │   ├── jules-api.js      # Jules API client (Google's coding assistant)
  │   ├── jules-queue.js    # Queue system for batch prompt processing
  │   ├── prompt-renderer.js # Markdown rendering with marked.js
  │   ├── prompt-list.js    # Sidebar tree navigation
  │   └── ...               # Other UI components (modals, dropdowns, etc.)
  ├── utils/                # Shared utilities (pure functions)
  │   ├── constants.js      # ALL magic strings, regex patterns, config
  │   ├── dom-helpers.js    # ALL DOM manipulation helpers
  │   ├── session-cache.js  # Session caching helpers
  │   └── ...
  └── styles/
      ├── base.css          # CSS variables and resets
      ├── layout.css        # Grid and responsive rules
      ├── components/       # Component styles
      └── pages/            # Page-specific overrides
functions/                  # Firebase Cloud Functions (Node.js 22)
browser-extension/          # Web capture Chrome extension
prompts/                    # Markdown prompt library
config/firestore/firestore.rules  # Firestore security rules
```

## Key Guidelines

### Creating New Features

**New Page**:
1. Create `pages/{name}/{name}.html` with `<script type="module" src="../../src/shared-init.js">` and `<script type="module" src="../../src/pages/{name}-page.js">`
2. Create `src/pages/{name}-page.js` with initialization logic
3. Add page styles in `src/styles/pages/{name}.css` if needed

**New Module** (feature):
1. Create `src/modules/{name}.js`
2. Use named exports only: `export function myFunction() {}`
3. Private state as module-level variables
4. Import dependencies: `import { something } from './other.js'`

**New Styles**:
1. Create `src/styles/components/{name}.css`
2. Add `@import 'components/{name}.css';` to `src/styles.css`
3. Use BEM naming: `.my-component`, `.my-component__element`, `.my-component--modifier`

### Database (Firestore)
- `julesQueues/{uid}/items` - User's Jules queue items
- `users/{uid}` - User profile and settings
- `apiKeys/{uid}` - Encrypted API keys (AES-GCM)
- Security rules in `config/firestore/firestore.rules` - users can only access their own data

### File Naming Conventions
- Use lowercase with hyphens: `my-module.js`, `my-component.css`, `my-page.html`
- Module files: `{feature}.js`
- Page init files: `{page}-page.js`
- CSS files: `{component}.css`

### Security
- NEVER commit secrets or API keys
- Jules API keys encrypted with AES-GCM before Firestore storage
- All Firestore rules enforce user-only data access
- Use GitHub OAuth via Firebase for authentication
- All API calls and hosting over HTTPS only

### What to NEVER Do
- ❌ Use build tools, bundlers, or transpilers
- ❌ Use default exports (`export default`)
- ❌ Add framework dependencies (React, Vue, Angular, etc.)
- ❌ Write HTML strings in JavaScript (`innerHTML = '<div>...'`)
- ❌ Use inline styles in JavaScript (`element.style.color = 'red'`)
- ❌ Commit node_modules or build artifacts
- ❌ Modify Firestore security rules without understanding implications
- ❌ Add npm dependencies to frontend (only backend Functions can use npm)
- ❌ Use global variables (`window.myVar = ...`)
- ❌ Use callbacks or raw promises (use async/await)

### When Working on Issues
1. Read related modules to understand data flow and patterns
2. Make minimal changes - smallest possible modification to solve the problem
3. Follow existing patterns - match the style and structure of surrounding code
4. Test in browser - open DevTools, check console for errors
5. Verify imports use correct relative paths
6. Update this file if making architectural changes
