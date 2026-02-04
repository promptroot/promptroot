# PromptRoot Code Style Guide

**Version:** 1.1  
**Last Updated:** January 18, 2026

This guide covers JavaScript patterns, module architecture, and coding conventions for the PromptRoot application. For UI/CSS guidelines, see [UI_GUIDELINES.md](UI_GUIDELINES.md).

**Recent Architecture Update (PR #218)**: All inline `<script>` blocks have been removed from HTML files. Each page now has a dedicated initialization file in `src/pages/`. See [Page Initialization Pattern](#page-initialization-pattern) section.

---

## Page Initialization Pattern

Each HTML page has a dedicated initialization file in `src/pages/` that handles page-specific setup:

### HTML Page Structure

```html
<!-- pages/example/example.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Example Page</title>
  <link rel="stylesheet" href="../../src/styles.css" />
</head>
<body>
  <!-- Page content -->
  
  <!-- Load shared components (header, Firebase) -->
  <script type="module" src="../../src/shared-init.js"></script>
  
  <!-- Load page-specific initialization -->
  <script type="module" src="../../src/pages/example-page.js"></script>
</body>
</html>
```

### Page Initialization File

```javascript
// src/pages/example-page.js
import { waitForFirebase } from '../shared-init.js';
import { someModule } from '../modules/some-module.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
  }
}

function initApp() {
  // Set up event handlers
  const btn = document.getElementById('myBtn');
  if (btn) {
    btn.onclick = handleClick;
  }
  
  // Initialize features
  waitForFirebase(() => {
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        loadUserData();
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
```

**Key Pattern**: Each page waits for shared components (header) to load before initializing page-specific functionality.

---

## File Type Segregation

**Critical Rule**: Keep file types separate. Do not mix languages in single files.

### ❌ Never Do This:

```javascript
// Bad: HTML strings in JavaScript
const html = `
  <div class="card">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
`;
element.innerHTML = html;
```

```javascript
// Bad: Inline CSS in JavaScript
element.style.color = 'red';
element.style.padding = '10px';
element.style.background = 'blue';
```

```html
<!-- Bad: Style tags in HTML -->
<style>
  .my-class { color: red; }
</style>

<!-- Bad: Script tags in HTML -->
<script>
  function myFunction() { }
</script>
```

### ✅ Do This Instead:

```javascript
// Good: Use createElement and classes
const card = createElement('div', 'card');
const heading = createElement('h2', '', title);
const desc = createElement('p', '', description);
card.appendChild(heading);
card.appendChild(desc);
element.appendChild(card);
```

```javascript
// Good: Use CSS classes for styling
element.classList.add('highlighted');
element.classList.add('padded');
```

```html
<!-- Good: Link external files -->
<link rel="stylesheet" href="src/styles.css" />
<script type="module" src="src/app.js"></script>
```

**Exceptions**:
- `style.display` manipulation is acceptable when toggling visibility dynamically, but prefer `.hidden` class
- Dynamic positioning/sizing (e.g., tooltips, popovers) may require direct style manipulation

---

## Module Architecture

### File Organization

```
src/
├── pages/            # Page-specific initialization
│   ├── index-page.js
│   ├── jules-page.js
│   ├── oauth-callback-page.js
│   ├── profile-page.js
│   ├── queue-page.js
│   ├── sessions-page.js
│   └── webcapture-page.js
├── modules/          # Feature modules
│   ├── auth.js
│   ├── branch-selector.js
│   ├── confirm-modal.js
│   ├── dropdown.js
│   ├── github-api.js
│   ├── header.js
│   ├── jules-account.js
│   ├── jules-api.js
│   ├── jules-free-input.js
│   ├── jules-keys.js
│   ├── jules-modal.js
│   ├── jules-queue.js
│   ├── jules-subtask-modal.js
│   ├── navbar.js
│   ├── prompt-list.js
│   ├── prompt-renderer.js
│   ├── prompt-viewer.js
│   ├── repo-branch-selector.js
│   ├── sidebar.js
│   ├── status-bar.js
│   ├── subtask-manager.js
│   └── toast.js
└── utils/            # Shared utilities
    ├── checkbox-helpers.js
    ├── constants.js
    ├── dom-helpers.js
    ├── session-cache.js
    ├── slug.js
    ├── title.js
    └── url-params.js
```

### Module Pattern

Use ES6 modules with named exports:

```javascript
// ✅ Good: Named exports
export function initComponent() { }
export function updateState() { }

// ❌ Avoid: Default exports
export default function() { }
```

### Module Responsibilities

- **Modules**: Feature-specific logic (auth, navigation, API integration)
- **Utils**: Pure functions, shared helpers, no side effects
- **Keep modules focused**: One primary responsibility per module

---

## DOM Manipulation

### DOM Helpers

Located in `src/utils/dom-helpers.js`:

```javascript
import { 
  createElement, 
  toggleClass, 
  clearElement, 
  onElement,
  stopPropagation 
} from '../utils/dom-helpers.js';
```

#### Available Functions

**createElement(tag, className, textContent)**
```javascript
const div = createElement('div', 'my-class', 'Text content');
const button = createElement('button', 'btn primary');
```

**toggleClass(element, className, force)**
```javascript
toggleClass(element, 'active');           // Toggle
toggleClass(element, 'open', true);       // Force add
toggleClass(element, 'hidden', false);    // Force remove
```

**clearElement(element)**
```javascript
clearElement(listElement); // Removes all child nodes
```

**onElement(element, event, handler)**
```javascript
onElement(button, 'click', handleClick);
```

**stopPropagation(event)**
```javascript
onElement(badge, 'click', (e) => {
  stopPropagation(e);
  // Handle badge click
});
```

---

## Visibility Management

### Preferred: Use `.hidden` Class

```javascript
// ✅ Good: Class-based visibility
element.classList.add('hidden');      // Hide
element.classList.remove('hidden');   // Show
element.classList.toggle('hidden');   // Toggle
```

### Avoid Direct Style Manipulation

```javascript
// ❌ Avoid: Direct style manipulation
element.style.display = 'none';
element.style.display = 'block';
```

**Exception**: Use direct manipulation only when dynamic values are required (e.g., positioning, animations).

---

## State Management

### Use State Classes

```javascript
// Modals
modal.classList.add('show');
modal.classList.remove('show');

// Dropdowns
dropdown.classList.add('open');
dropdown.classList.remove('open');

// Tree items
treeItem.classList.add('submenu-open');
treeItem.classList.remove('submenu-open');

// Active items
listItem.classList.add('active');
siblingItem.classList.remove('active');
```

### Avoid Data Attributes for State

```javascript
// ❌ Avoid: data-* for frequently-changed state
element.dataset.open = 'true';

// ✅ Good: CSS classes for state
element.classList.add('open');
```

**Use data-* for**: Static metadata, component configuration, identifiers

---

## Event Handling

### Event Delegation

Prefer delegated event listeners for dynamic content:

```javascript
// ✅ Good: Event delegation
listEl.addEventListener('click', (event) => {
  const badge = event.target.closest('.tag-badge');
  if (badge) {
    event.preventDefault();
    event.stopPropagation();
    handleBadgeClick(badge);
  }
});
```

```javascript
// ❌ Avoid: Individual listeners on dynamic elements
items.forEach(item => {
  item.addEventListener('click', handleClick);
});
```

### Event Cleanup

Remove event listeners when components are destroyed:

```javascript
function destroy() {
  element.removeEventListener('click', handleClick);
  window.removeEventListener('resize', handleResize);
}
```

### Outside Click Detection

```javascript
function setupOutsideClick(element, callback) {
  document.addEventListener('click', (e) => {
    if (!element.contains(e.target)) {
      callback();
    }
  });
}
```

---

## Async Patterns

### Use async/await

```javascript
// ✅ Good: async/await
async function loadData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to load data:', error);
    showStatus('Failed to load data', 'error');
  }
}
```

### Error Handling

Always handle errors in async functions:

```javascript
// ✅ Good: Error handling
async function submitForm() {
  try {
    const result = await api.submit(data);
    showStatus('Submitted successfully', 'success');
    return result;
  } catch (error) {
    console.error('Submission failed:', error);
    showStatus('Submission failed', 'error');
    throw error; // Re-throw if caller needs to handle
  }
}
```

---

## Component Initialization

### Consistent Init Pattern

```javascript
export function initComponent() {
  // 1. Get DOM elements
  const container = document.getElementById('container');
  const button = document.getElementById('submitBtn');
  
  if (!container) {
    console.warn('Container not found, skipping init');
    return;
  }
  
  // 2. Set initial state
  loadInitialData();
  
  // 3. Attach event listeners
  button?.addEventListener('click', handleSubmit);
  
  // 4. Additional setup
  setupKeyboardHandlers();
}
```

### Null Safety

Check for element existence before attaching listeners:

```javascript
// ✅ Good: Null checks
const button = document.getElementById('myBtn');
if (button) {
  button.addEventListener('click', handleClick);
}

// Or use optional chaining
button?.addEventListener('click', handleClick);
```

---

## Modal Management

### Opening Modals

```javascript
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.add('show');
  trapFocus(modal);
  
  // Store reference to previously focused element
  modal.dataset.previousFocus = document.activeElement;
  
  // Focus first input
  const firstInput = modal.querySelector('input, textarea, button');
  firstInput?.focus();
}
```

### Closing Modals

```javascript
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('show');
  
  // Restore focus
  const previousFocus = document.querySelector(modal.dataset.previousFocus);
  previousFocus?.focus();
  
  // Clear form inputs if needed
  const form = modal.querySelector('form');
  form?.reset();
}
```

### Keyboard Handlers

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      closeModal(openModal.id);
    }
  }
});
```

---

## Dropdown Management

### Toggle Dropdown

```javascript
function toggleDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const menu = dropdown.querySelector('.custom-dropdown-menu');
  const button = dropdown.querySelector('.custom-dropdown-btn');
  
  const isOpen = menu.style.display === 'block';
  
  // Close all other dropdowns
  document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
    m.style.display = 'none';
  });
  
  // Toggle this dropdown
  if (!isOpen) {
    menu.style.display = 'block';
    button.setAttribute('aria-expanded', 'true');
  } else {
    menu.style.display = 'none';
    button.setAttribute('aria-expanded', 'false');
  }
}
```

### Close on Outside Click

```javascript
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-dropdown')) {
    document.querySelectorAll('.custom-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }
});
```

---

## Status Messages

### Show Status

```javascript
import statusBar from './modules/status-bar.js';

// Show message with auto-hide
statusBar.showMessage('Changes saved successfully', { timeout: 3000 });

// Show message without auto-hide
statusBar.showMessage('Processing...', { timeout: 0 });

// Add progress indicator
statusBar.setProgress('Step 1 of 3', 33);

// Clear progress
statusBar.clearProgress();

// Add action button
statusBar.setAction('Retry', handleRetry);

// Clear action
statusBar.clearAction();

// Hide status bar
statusBar.hide();

// Clear everything
statusBar.clear();
```

**Guidelines**:
- Use `timeout: 0` for persistent messages
- Default timeout is 3000ms (3 seconds)
- Call `clear()` to reset all elements

### Replace Native Dialogs

```javascript
// ❌ Avoid: Blocking native dialogs
alert('Success!');
const confirmed = confirm('Are you sure?');
const input = prompt('Enter value:');

// ✅ Good: Non-blocking UI
statusBar.showMessage('Success!', { timeout: 3000 });
openConfirmModal('Are you sure?', handleConfirm);
openInputModal('Enter value:', handleInput);
```

---

## API Integration

### GitHub API Pattern

```javascript
// src/modules/github-api.js
export async function fetchRepos(owner) {
  const url = `https://api.github.com/users/${owner}/repos`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch repos:', error);
    throw error;
  }
}
```

### Jules API Pattern

```javascript
// src/modules/jules-api.js
export async function submitTask(task, apiKey) {
  const url = 'https://api.jules.com/v1/tasks';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(task)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Jules API error:', error);
    throw error;
  }
}
```

---

## Constants

### Using Shared Constants

All magic strings and regex patterns should be defined in `src/utils/constants.js`:

```javascript
import { 
  OWNER, 
  REPO, 
  BRANCH, 
  STORAGE_KEYS, 
  TAG_DEFINITIONS,
  ERRORS,
  UI_TEXT,
  JULES_API_BASE,
  TIMEOUTS,
  LIMITS,
  RETRY_CONFIG
} from '../utils/constants.js';

// Repository defaults
console.log(OWNER, REPO, BRANCH);

// Storage keys
localStorage.setItem(STORAGE_KEYS.expandedState(owner, repo, branch), state);

// Error messages
throw new Error(ERRORS.AUTH_REQUIRED);

// UI text
button.textContent = UI_TEXT.SIGN_IN;

// API base URL
const url = `${JULES_API_BASE}/sessions`;

// Timeouts and Delays
setTimeout(waitForComponents, TIMEOUTS.componentCheck);
await new Promise(r => setTimeout(r, TIMEOUTS.uiDelay));

// Retry Logic
let retryCount = 0;
while (retryCount < RETRY_CONFIG.maxRetries) {
  // ...
  await new Promise(r => setTimeout(r, RETRY_CONFIG.baseDelay));
}
```

**Available constants**:
- `TIMEOUTS`: Standardized delays (componentCheck, uiDelay, toast, etc.)
- `LIMITS`: Operational limits (firebaseMaxAttempts, etc.)
- `RETRY_CONFIG`: Retry configuration (maxRetries, baseDelay)
- `OWNER`, `REPO`, `BRANCH`: Default repository info
- `STORAGE_KEYS`: Functions to generate storage keys
- `TAG_DEFINITIONS`: Tag classification config
- `ERRORS`: Error message strings
- `UI_TEXT`: UI label strings
- `JULES_API_BASE`: Jules API base URL
- `GIST_POINTER_REGEX`, `GIST_URL_REGEX`, `CODEX_URL_REGEX`: URL validation

---

## Session Caching

### Using Session Cache

```javascript
import { setCache, getCache, clearCache, clearAllCache, CACHE_KEYS } from '../utils/session-cache.js';

// Save to cache
setCache(CACHE_KEYS.JULES_SESSIONS, sessionsData, userId);

// Load from cache
const cached = getCache(CACHE_KEYS.JULES_SESSIONS, userId);

// Clear specific cache
clearCache(CACHE_KEYS.JULES_SESSIONS, userId);

// Clear all caches
clearAllCache();
```

**Cache expiration**:
- Some keys cache for entire session (no expiration)
- Some keys expire after 5 minutes
- Defined in `CACHE_DURATION` in `session-cache.js`

**Available cache keys**:
- `CACHE_KEYS.JULES_ACCOUNT`
- `CACHE_KEYS.JULES_SESSIONS`
- `CACHE_KEYS.JULES_REPOS`
- `CACHE_KEYS.QUEUE_ITEMS`
- `CACHE_KEYS.BRANCHES`
- `CACHE_KEYS.CURRENT_BRANCH`
- `CACHE_KEYS.CURRENT_REPO`
- `CACHE_KEYS.USER_PROFILE`

---

## URL Parameter Handling

### Parse URL Parameters

```javascript
import { parseParams, getHashParam, setHashParam } from '../utils/url-params.js';

// Parse all params from query string and hash
const params = parseParams();

// Get specific hash parameter
const fileSlug = getHashParam('file');

// Set hash parameter
setHashParam('file', 'my-prompt');
```

**Guidelines**:
- Use `parseParams()` to get all URL parameters
- Use `getHashParam()` for hash-based routing
- Use `setHashParam()` to update hash parameters

---

## Session Caching

### Constants

Define storage keys in `src/utils/constants.js`:

```javascript
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'promptroot_auth_token',
  USER_PREFS: 'promptroot_user_prefs',
  JULES_API_KEY: 'promptroot_jules_key',
  LAST_REPO: 'promptroot_last_repo'
};
```

### Usage

```javascript
import { STORAGE_KEYS } from '../utils/constants.js';

// Save
localStorage.setItem(STORAGE_KEYS.USER_PREFS, JSON.stringify(prefs));

// Load
const prefs = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PREFS) || '{}');

// Remove
localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
```

---

## Naming Conventions

### Variables

```javascript
// camelCase for variables and functions
const userName = 'John';
const isActive = true;
function getUserData() { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Prefix booleans with is/has/should
const isLoading = false;
const hasError = true;
const shouldRetry = false;
```

### Functions

```javascript
// Verbs for actions
function loadData() { }
function saveChanges() { }
function deleteItem() { }

// handle* for event handlers
function handleClick(event) { }
function handleSubmit(event) { }

// on* for callbacks
function onDataLoaded(data) { }
function onError(error) { }

// init* for initialization
function initComponent() { }
function initEventListeners() { }
```

### Element Selectors

```javascript
// Suffix with El for DOM elements
const containerEl = document.getElementById('container');
const buttonEl = document.querySelector('.btn');
const inputEls = document.querySelectorAll('input');
```

---

## Comments

### JSDoc for Public Functions

```javascript
/**
 * Loads prompt data from GitHub repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path within repository
 * @returns {Promise<Object>} Prompt data
 */
export async function loadPrompt(owner, repo, path) {
  // Implementation
}
```

### Inline Comments

```javascript
// ✅ Good: Explain "why", not "what"
// Cache DOM queries to avoid repeated lookups
const elements = new Map();

// ❌ Avoid: Obvious comments
// Set the display to none
element.style.display = 'none';
```

---

## Anti-Patterns

### ❌ HTML String Generation

```javascript
// Bad: HTML in JavaScript
element.innerHTML = `<div class="item">${name}</div>`;

// Good: Use createElement helper
const item = createElement('div', 'item', name);
element.appendChild(item);
```

### ❌ Inline CSS in JavaScript

```javascript
// Bad: Style manipulation for presentation
element.style.color = 'red';
element.style.fontSize = '14px';

// Good: CSS classes
element.classList.add('error-text');
```

### ❌ Global Variables

```javascript
// Bad: Pollutes global scope
window.currentUser = user;

// Good: Module-scoped
let currentUser = null;
export function setCurrentUser(user) {
  currentUser = user;
}
```

### ❌ Inline Event Handlers

```html
<!-- Bad: Inline handlers -->
<button onclick="handleClick()">Click</button>

<!-- Good: JavaScript event listeners -->
<button id="myButton">Click</button>
```

```javascript
document.getElementById('myButton').addEventListener('click', handleClick);
```

### ❌ Hard-coded IDs

```javascript
// Bad: Hard-coded, not reusable
function openModal() {
  document.getElementById('myModal').classList.add('show');
}

// Good: Parameterized
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('show');
}
```

### ❌ Synchronous Operations

```javascript
// Bad: Blocks main thread
const data = fetchDataSync();

// Good: Async
const data = await fetchData();
```

---

## Anti-Patterns

### ❌ HTML String Generation

```javascript
// Bad: HTML in JavaScript
element.innerHTML = `<div class="item">${name}</div>`;

// Good: Use createElement helper
const item = createElement('div', 'item', name);
element.appendChild(item);
```

### ❌ Inline CSS in JavaScript

```javascript
// Bad: Style manipulation for presentation
element.style.color = 'red';
element.style.fontSize = '14px';

// Good: CSS classes
element.classList.add('error-text');
```

### ❌ Global Variables

```javascript
// Bad: Pollutes global scope
window.currentUser = user;

// Good: Module-scoped
let currentUser = null;
export function setCurrentUser(user) {
  currentUser = user;
}
```

---

## Error Handling

### Consistent Error Handling

```javascript
// ✅ Good: Try-catch with user feedback
async function loadData() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    console.error('Failed to load data:', error);
    showStatus('Failed to load data', 'error');
    throw error; // Re-throw if caller needs to handle
  }
}
```

### Console Logging Conventions

```javascript
// Errors: Use console.error
console.error('Failed to fetch data:', error);

// Warnings: Use console.warn
console.warn('Cache expired, refetching...');

// Debug info: Use console.log (remove before production)
console.log('Debug: current state:', state);

// Info: Rarely used
console.info('Module initialized');
```

**Guidelines**:
- Always log errors with context
- Include error object in console.error
- Remove debug console.log statements before committing
- Use `showStatus()` for user-facing errors

### Status Bar for User Errors

```javascript
import statusBar from './modules/status-bar.js';

// Show error to user
statusBar.showMessage('Failed to save changes', { timeout: 5000 });

// With progress
statusBar.setProgress('Uploading...', 50);

// With action button
statusBar.setAction('Retry', handleRetry);

// Clear everything
statusBar.clear();
```

---

## Testing Considerations

### Testable Functions

```javascript
// ✅ Good: Pure, testable
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Avoid: Side effects make testing harder
function calculateTotal(items) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('total').textContent = total;
  return total;
}
```

### Separate DOM from Logic

```javascript
// Logic (testable)
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// DOM interaction (separate)
function checkEmailInput() {
  const email = inputEl.value;
  const isValid = validateEmail(email);
  toggleClass(inputEl, 'error', !isValid);
}
```

---
---

## Testing

The project uses [Vitest](https://vitest.dev/) for automated testing with jsdom for DOM simulation.

### Test Structure

Tests are located in `src/tests/` and organized by purpose:

```
src/tests/
├── setup.js          # Global test configuration (Firebase/localStorage mocks)
├── integration/      # Integration tests for modules with dependencies
│   ├── auth.test.js
│   ├── toast.test.js
│   ├── jules-submission.test.js
│   └── prompt-loading.test.js
└── utils/           # Unit tests for pure utility functions
    ├── dom-helpers.test.js
    ├── slug.test.js
    ├── title.test.js
    └── validation.test.js
```

### Running Tests

```bash
npm test              # Watch mode - reruns on file save
npm run test:run      # Run once
npm run test:coverage # Generate coverage report
```

Coverage reports are generated in `coverage/` directory. The project enforces minimum coverage thresholds: 60% lines/functions, 50% branches.

### Writing Tests

#### Unit Tests
Focus on pure functions in `src/utils/`. These tests should verify logic without external dependencies.

```javascript
import { describe, it, expect } from 'vitest';
import { myUtility } from '../../utils/my-utility.js';

describe('myUtility', () => {
  it('should return correct value', () => {
    expect(myUtility(input)).toBe(expected);
  });
  
  it('should handle edge cases', () => {
    expect(myUtility(null)).toBe(null);
    expect(myUtility('')).toBe('');
  });
});
```

#### Integration Tests
Focus on modules in `src/modules/` that interact with DOM or APIs. Use `vi.mock()` to mock external dependencies.

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGitHub } from '../../modules/auth.js';
import { showToast } from '../../modules/toast.js';

// Mock dependencies at top of file
vi.mock('../../modules/toast.js');

describe('signInWithGitHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should show error when auth not ready', async () => {
    const originalAuth = window.auth;
    window.auth = null;
    
    await signInWithGitHub();
    
    expect(showToast).toHaveBeenCalledWith(
      'Authentication not ready. Please refresh the page.',
      'error'
    );
    
    window.auth = originalAuth; // Restore for next tests
  });
  
  it('should store token on successful sign in', async () => {
    window.auth.signInWithPopup.mockResolvedValue({
      credential: { accessToken: 'token123' }
    });
    
    await signInWithGitHub();
    
    expect(window.auth.signInWithPopup).toHaveBeenCalled();
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith(
      'github_access_token',
      expect.any(String)
    );
  });
});
```

#### Best Practices
- **Test behavior, not implementation** - Focus on what the function does, not how
- **One assertion concept per test** - Each test should verify one thing
- **Use descriptive test names** - `should show error when API fails` not `test error`
- **Mock external dependencies** - Don't make real API calls or Firebase requests
- **Use `vi.mock()` at module level** - Place mocks before imports for proper hoisting
- **Verify mock calls with `vi.mocked()`** - Wrap localStorage/window objects: `vi.mocked(localStorage.setItem)`
- **Clean up after tests** - Use `beforeEach`/`afterEach` to reset state and clear mocks
- **Avoid fake timers for DOM animations** - Use real timers for modules using `requestAnimationFrame`
- **Setup file provides global mocks** - Firebase, localStorage, and window objects are pre-mocked

### Global Test Setup

The `src/tests/setup.js` file provides shared mocks for all tests:
- `window.auth` - Firebase authentication mock
- `window.db` - Firestore mock
- `localStorage` - Storage mock wrapped in `vi.fn()` for spy assertions
- `window.firebase.auth.GithubAuthProvider` - Auth provider mock

## Performance

### Debounce User Input

```javascript
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Usage
searchInput.addEventListener('input', debounce((e) => {
  performSearch(e.target.value);
}, 300));
```

### Cache DOM Queries

```javascript
// ❌ Avoid: Repeated queries
function updateUI() {
  document.getElementById('title').textContent = title;
  document.getElementById('title').style.color = 'red';
  document.getElementById('title').classList.add('active');
}

// ✅ Good: Cache the query
function updateUI() {
  const titleEl = document.getElementById('title');
  titleEl.textContent = title;
  titleEl.style.color = 'red';
  titleEl.classList.add('active');
}
```

### Batch DOM Updates

```javascript
// ❌ Avoid: Multiple reflows
items.forEach(item => {
  list.appendChild(createListItem(item));
});

// ✅ Good: Document fragment
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createListItem(item));
});
list.appendChild(fragment);
```

---

## File Reference

### Key Modules

| Module | Purpose |
|--------|---------|
| `auth.js` | Firebase authentication |
| `github-api.js` | GitHub API integration |
| `jules-api.js` | Jules AI API integration |
| `prompt-list.js` | Sidebar tree navigation |
| `status-bar.js` | Status notifications |
| `header.js` | Shared header component |
| `navbar.js` | Bottom navigation |

### Key Utilities

| Utility | Purpose |
|---------|---------|
| `dom-helpers.js` | DOM manipulation helpers |
| `constants.js` | Shared constants and configs |
| `slug.js` | String slugification |
| `url-params.js` | URL parameter handling |
| `session-cache.js` | Session caching |
| `title.js` | Extract titles from markdown |
| `checkbox-helpers.js` | Mutual exclusivity for checkboxes - `setupMutualExclusivity(id1, id2)` |

**Example usage:**

```javascript
// src/pages/index-page.js
import { setupMutualExclusivity } from '../utils/checkbox-helpers.js';

// Make checkboxes mutually exclusive (call at module level)
setupMutualExclusivity('julesEnvSuppressPopupsCheckbox', 'julesEnvOpenInBackgroundCheckbox');
setupMutualExclusivity('freeInputSuppressPopupsCheckbox', 'freeInputOpenInBackgroundCheckbox');
```

---

## Version History

- **v1.1** (Jan 18, 2026): Added Vitest testing infrastructure with 44 tests across 8 test files
- **v1.0** (Jan 6, 2026): Initial code style guide with PR #218 page architecture

---

**Questions?** Check existing implementations in `src/pages/` and `src/modules/` for reference patterns. For UI/CSS guidelines, see [UI_GUIDELINES.md](UI_GUIDELINES.md).
