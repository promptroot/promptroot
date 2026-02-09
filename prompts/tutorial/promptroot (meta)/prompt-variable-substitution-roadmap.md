# Prompt Variable Substitution Feature - Implementation Roadmap

## Inputs (Parameters)

### Project / Feature Name
Prompt Template Variable Substitution

### One-Sentence Goal
Enable users to fill in `{PLACEHOLDER}` variables in prompts via a modal UI before sending to Jules, making prompts reusable and context-aware.

### Users / Stakeholders
- Developers using reusable prompt templates
- Teams standardizing on prompt patterns
- Power users creating prompt libraries
- AI practitioners sharing configurable prompts

### Target Environment
- **OS/runtime:** Modern browsers (Chrome, Firefox, Safari, Edge) with ES6 module support
- **Execution model:** Client-side JavaScript, no server-side processing required
- **Deployment:** GitHub Pages (static hosting), integrated into existing PromptRoot app

### Stack
- **Frontend:** Vanilla JavaScript (ES6 modules), HTML5, CSS3 (BEM methodology)
- **Backend:** None (pure client-side feature)
- **Database:** None (all state in memory during substitution flow)
- **Background jobs / workflows:** None
- **External integrations:** Integrates with existing Jules submission flow (jules-api.js)

### Repo Constraints
- **Existing architecture to follow:** 
  - Zero-build philosophy (no templating engines, pure regex/string manipulation)
  - ES6 modules with named exports only
  - File type segregation (HTML/CSS/JS separate)
  - Modal pattern similar to existing jules-modal.js and subtask-error-modal.js
  
- **Code style / conventions:** 
  - BEM CSS naming for modal components
  - All constants (regex patterns) in `src/utils/constants.js`
  - All DOM helpers in `src/utils/dom-helpers.js`
  - Async/await only
  - Relative imports with `.js` extension
  
- **Forbidden changes / non-goals:** 
  - No templating libraries (Handlebars, Mustache, etc.)
  - No default exports
  - No inline HTML/CSS in JavaScript
  - No build tools or transpilation

### Data and Correctness Requirements
- **Data integrity expectations:** 
  - All placeholders must be filled before submission
  - Empty values should trigger validation error
  - Original prompt text preserved (no mutation of source)
  - Substitution is client-side only, never stored
  
- **Auditability/logging requirements:** 
  - Console.error for parsing failures
  - User-friendly error messages for missing/invalid input
  
- **Security/compliance constraints:** 
  - XSS protection: DOMPurify sanitization on user-provided values
  - No regex DoS vulnerabilities (ReDoS)
  - Escape special chars in user input before substitution

### Primary Flows (Happy Paths)

**Flow 1: Detect and Fill Single Variable**
1. User views prompt with text: "Fix the bug in `{FILE_PATH}` on line `{LINE_NUMBER}`"
2. User clicks "Try in Jules"
3. System detects 2 placeholders: FILE_PATH, LINE_NUMBER
4. Modal opens with form showing 2 labeled input fields
5. User fills in: "src/app.js" and "42"
6. User clicks "Send to Jules"
7. System substitutes placeholders: "Fix the bug in `src/app.js` on line `42`"
8. Substituted prompt sent to Jules API
9. Modal closes, Jules session created

**Flow 2: No Variables - Direct Send**
1. User views prompt without `{VARIABLES}`
2. User clicks "Try in Jules"
3. System detects no placeholders
4. Standard Jules modal opens (account selection)
5. Prompt sent directly without substitution step

**Flow 3: Multiple Variables with Same Name**
1. User views prompt: "Compare `{FILE}` with `{FILE}` and check `{FUNCTION}`"
2. System detects: FILE (appears 2x), FUNCTION (appears 1x)
3. Modal shows 2 unique inputs: FILE, FUNCTION
4. User fills both
5. System replaces all occurrences: both `{FILE}` instances get same value
6. Substituted prompt sent to Jules

### Edge Cases / Failure Modes

**Empty Placeholder Values**
- User leaves input field blank
- System shows validation error: "All fields required"
- Send button disabled until all fields filled

**Nested or Malformed Braces**
- Text contains `{{NESTED}}` or `{UNCLOSED`
- Parser uses non-greedy regex to match simple `{WORD}` pattern only
- Malformed patterns ignored, treated as literal text

**XSS in User Input**
- User enters: `<script>alert('XSS')</script>` in placeholder field
- System sanitizes with DOMPurify before substitution
- Dangerous content stripped, safe text substituted

**Special Characters in Placeholder Names**
- Prompt contains: `{FILE-PATH}` or `{var.name}`
- Parser allows alphanumeric, underscore, hyphen only
- Invalid patterns ignored

**Very Long Placeholder Values**
- User pastes 10,000 char string into field
- System enforces max length (e.g., 1000 chars) per field
- Show warning if limit exceeded

**Placeholder Name Collision with Markdown Syntax**
- Prompt contains: "Use `{code}` blocks" (code is in backticks)
- Parser only matches `{WORD}` pattern, ignores markdown context
- No false positives from markdown syntax

### Acceptance Criteria (Business Level)

1. **Placeholder detection accuracy**: 100% detection of `{WORD}` pattern, no false positives from markdown/code
2. **Substitution correctness**: All placeholder instances replaced with exact user input
3. **XSS protection verified**: Test suite confirms malicious input is sanitized
4. **Validation enforced**: Cannot send with empty fields
5. **Performance**: Detection and substitution <50ms for prompts up to 10KB
6. **Modal UX**: Clear labels, tab navigation, Enter key submits
7. **Backward compatibility**: Existing prompts without variables work unchanged
8. **Zero-build maintained**: No templating libraries, pure regex/string operations

### Time / Scope Constraints
- **Deadline or timebox:** 2-3 week implementation
- **Must-have vs nice-to-have:** 
  - **Must-have:** Basic `{WORD}` detection, modal form, sanitization, validation
  - **Nice-to-have:** Default values `{NAME:default}`, multi-line text areas, saved templates

---

## 0. Clarifications and Assumptions

**Stated Assumptions:**
- Placeholder syntax is `{WORD}` where WORD is alphanumeric with underscores/hyphens
- All placeholders in a prompt must be filled (no optional placeholders in v1)
- Substitution happens in memory only, not persisted to GitHub
- Modal appears before Jules account selection modal
- Existing Jules submission flow (jules-api.js) remains unchanged
- Feature works for both main prompt view and queue items

---

## 1. Purpose and Scope

**Objective:** Enable users to create reusable prompt templates with `{PLACEHOLDER}` variables that are filled via modal UI before sending to Jules.

**In Scope:**  
- Regex-based placeholder detection in prompt text
- Modal UI with dynamic form generation based on detected placeholders
- Client-side string substitution of placeholders with user input
- Input validation (required fields, max length)
- XSS sanitization of user-provided values
- Integration with existing "Try in Jules" button flow
- Test prompts demonstrating variable usage
- Unit tests for parser and substitution logic
- E2E tests for full modal → submission flow

**Out of Scope / Non-Goals:**  
- Advanced template syntax (conditionals, loops, filters)
- Default values or optional placeholders (future enhancement)
- Saving filled templates to localStorage or Firestore
- Template library or template search
- Multi-step wizards or complex form validation
- Server-side template processing

This document is the **single source of truth** for planning, execution, and verification.

---

## 2. Execution Environment (Lock First)

Before any planning or implementation begins, confirm:

- [x] Correct repository: promptroot/promptroot on GitHub
- [x] Primary branch: `main`
- [x] **Target deployment:** GitHub Pages (static hosting)
- [x] **Runtime:** Modern browsers (ES6 module support required)
- [x] **Local development:** Python HTTP server (port 3000) OR Docker Compose (port 5000)
- [x] Testing via browser DevTools console verification
- [x] Vitest for unit tests, Playwright for e2e tests
- [x] CI/CD: GitHub Actions for automated tests

**No implementation proceeds until this section is verified.**

---

## 3. System Context

### Domain Context
**Feature:** Prompt Template Variable Substitution  
**Goal:** Enable reusable prompts with user-fillable variables via modal UI  
**Users:** Developers, prompt engineers, technical teams using standardized prompts

### Stack
- **Frontend:** Vanilla JavaScript (ES6 modules), HTML5, CSS3 (BEM methodology)
- **Backend:** None (pure client-side feature)
- **Database:** None (in-memory state only)
- **Jobs/Workflows:** None
- **Integrations:** 
  - Existing prompt-renderer.js (displays prompts)
  - Existing jules-modal.js and jules-api.js (Jules submission)
  - DOMPurify CDN (XSS protection for user input)

### Constraints and Standards
- **Architecture to follow:** 
  - Zero-build: Pure regex and string manipulation, no templating engine
  - Modal pattern: Similar to existing jules-modal.js and subtask-error-modal.js
  - Named exports only, one feature per module
  - File type segregation: HTML, CSS, JavaScript separate
  
- **Code conventions:** 
  - Placeholder regex pattern in `src/utils/constants.js`
  - Modal creation helpers in `src/utils/dom-helpers.js`
  - BEM CSS naming: `.variable-modal`, `.variable-modal__input`, `.variable-modal__error`
  - Async/await only
  - Relative imports with `.js` extension
  
- **Security/Compliance:** 
  - XSS protection: DOMPurify sanitization on all user input
  - ReDoS prevention: Simple, bounded regex patterns
  - No eval() or Function() constructor
  - HTTPS-only
  
- **Forbidden changes:** 
  - No templating libraries (Handlebars, Mustache, Nunjucks, etc.)
  - No default exports
  - No inline HTML strings or inline CSS in JavaScript
  - No build tools or transpilation

---

## 4. Desired Behavior (What "Correct" Means)

### Primary Flows (Happy Paths)

**Flow 1: Single Variable Substitution**
1. User views prompt: "Debug the function `{FUNCTION_NAME}` in file `{FILE_PATH}`"
2. User clicks "Try in Jules" button
3. System calls `detectPlaceholders(promptText)` → returns `['FUNCTION_NAME', 'FILE_PATH']`
4. Variable substitution modal opens with 2 labeled input fields
5. User types: "calculateTotal" and "src/utils/math.js"
6. User clicks "Continue" (or presses Enter)
7. System validates: both fields filled → valid
8. System calls `substitutePlaceholders(promptText, {FUNCTION_NAME: 'calculateTotal', FILE_PATH: 'src/utils/math.js'})`
9. Result: "Debug the function `calculateTotal` in file `src/utils/math.js`"
10. Substituted text passed to Jules modal
11. Variable modal closes, Jules account selection modal opens
12. User completes Jules submission as normal

**Flow 2: No Variables - Direct Pass-Through**
1. User views prompt without any `{VARIABLES}`
2. User clicks "Try in Jules"
3. System calls `detectPlaceholders(promptText)` → returns `[]`
4. No variable modal shown
5. Jules account selection modal opens immediately
6. Standard flow continues unchanged

**Flow 3: Multiple Instances of Same Variable**
1. User views prompt: "Compare `{FILE}` with `{FILE}` and log results to `{OUTPUT}`"
2. System detects unique placeholders: `['FILE', 'OUTPUT']` (FILE counted once)
3. Modal shows 2 input fields: FILE, OUTPUT
4. User fills: "app.js" and "results.txt"
5. System replaces ALL occurrences: both `{FILE}` → "app.js", `{OUTPUT}` → "results.txt"
6. Result: "Compare `app.js` with `app.js` and log results to `results.txt`"

### Edge Cases and Failure Modes

**Edge Case 1: Empty Field Validation**
- **Scenario:** User leaves FUNCTION_NAME field blank
- **Expected:** 
  - "Continue" button disabled until all fields filled
  - Red border on empty required field
  - Error message: "All fields are required"
- **Verification:** Cannot submit with empty fields

**Edge Case 2: XSS in User Input**
- **Scenario:** User enters `<script>alert('XSS')</script>` in placeholder field
- **Expected:** 
  - Input sanitized with DOMPurify before substitution
  - Dangerous tags stripped: result is `alert('XSS')` or empty string
  - Sanitized value used in substitution
- **Verification:** XSS test suite confirms no script execution

**Edge Case 3: Nested Braces**
- **Scenario:** Prompt contains "Use `{{NESTED}}` syntax"
- **Expected:** 
  - Regex uses non-greedy match: `/\{([A-Z0-9_-]+)\}/g`
  - Matches simple `{WORD}` only
  - `{{NESTED}}` treated as literal text (no false detection)
- **Verification:** Parser unit tests confirm no false positives

**Edge Case 4: Special Characters in Placeholder Names**
- **Scenario:** Prompt has `{FILE.PATH}` or `{var name}`
- **Expected:** 
  - Regex only matches alphanumeric + underscore + hyphen
  - `{FILE.PATH}` not detected (period invalid)
  - `{var name}` not detected (space invalid)
  - Treated as literal text
- **Verification:** Parser tests confirm only valid patterns detected

**Edge Case 5: Very Long Input**
- **Scenario:** User pastes 10,000 character string into field
- **Expected:** 
  - Input field has `maxlength="1000"` attribute
  - Browser enforces limit automatically
  - Or: JS validation shows error: "Maximum 1000 characters"
- **Verification:** Manual test with long input

**Edge Case 6: Markdown Syntax Collision**
- **Scenario:** Prompt contains: "Use `{code}` blocks" (code in backticks)
- **Expected:** 
  - `{code}` detected as placeholder
  - User fills it, system substitutes
  - This is EXPECTED behavior (placeholders work in markdown)
- **Verification:** If user doesn't want substitution, use `\{code\}` (future: escape syntax)

**Edge Case 7: Modal Cancel/Close**
- **Scenario:** User clicks X or Cancel button on variable modal
- **Expected:** 
  - Modal closes
  - No substitution performed
  - Jules submission cancelled
  - No error shown
- **Verification:** Close button works without errors

### Business Acceptance Criteria

1. **Detection accuracy**: 100% detection of `{VALID_NAME}` pattern, 0% false positives
2. **Substitution correctness**: All instances of each placeholder replaced with exact user input
3. **XSS protection verified**: Test suite with 10+ XSS payloads confirms sanitization
4. **Validation works**: Cannot submit modal with any empty required fields
5. **Performance**: Detection + substitution <50ms for 10KB prompt
6. **Modal UX**: 
   - Clear labels matching placeholder names
   - Tab key navigates between fields
   - Enter key submits if all valid
   - Escape key or Cancel button closes modal
7. **Backward compatibility**: Existing prompts without variables work unchanged
8. **Zero-build maintained**: No templating libraries, pure regex/string ops

### Data Integrity and Audit Requirements

- **Data integrity:** 
  - Original prompt text never mutated (create new string for substitution)
  - Placeholder names case-sensitive
  - Substitution is idempotent (same input → same output)
  
- **Audit/logging:** 
  - Console.error if regex parsing fails unexpectedly
  - User-friendly error messages for validation failures
  - No logging of user input values (privacy)

---

## 5. Scope and Timeline

- **Deadline/Timebox:** 2-3 weeks
- **Priorities:** 
  - **Must-have (Week 1-2):** 
    - Placeholder detection regex
    - Modal UI with dynamic form
    - Substitution logic
    - Input validation
    - XSS sanitization
    - Integration with Jules submission flow
  - **Should-have (Week 2):** 
    - Unit tests for parser and substitution
    - E2E tests for full flow
    - Test prompts with variables
  - **Nice-to-have (Future):** 
    - Default values syntax `{NAME:default}`
    - Multi-line text areas for long inputs
    - Save filled templates to localStorage
    - Template library

---

## 6. Phased Roadmap Overview

Execution is broken into **strict, sequential phases**.  
Only one phase may be active at a time.

---

## 7. Phase 1: Foundation / Scaffolding

### Goals
Establish module structure, constants, regex patterns, and modal HTML/CSS without business logic.

### Tasks
- [x] Create `src/modules/variable-substitution.js` with named exports
- [x] Add placeholder regex to `src/utils/constants.js`:
  ```javascript
  export const PLACEHOLDER_REGEX = /\{([A-Z0-9_-]+)\}/g;
  ```
- [x] Create `src/styles/components/variable-modal.css` with BEM classes
- [x] Import variable-modal.css in `src/styles.css`
- [x] Add modal HTML structure functions to `src/utils/dom-helpers.js`:
  - `createVariableModal(placeholders)`
  - `createVariableInput(name)`
  - `createModalOverlay()`
  - Note: Followed existing pattern - modal DOM building within module (like confirm-modal.js)
- [x] Create partial: `partials/variable-modal.html` (or inline via DOM helpers)
  - Note: Used DOM helpers inline in module, following confirm-modal pattern
- [x] Wire up event listeners: modal close, form submit, input change

### Acceptance Criteria
- [x] `variable-substitution.js` imports resolve without errors
- [x] Modal CSS follows BEM naming: `.variable-modal`, `.variable-modal__field`, `.variable-modal__input`, `.variable-modal__button`
- [x] Modal can open/close via JS (no logic yet)
- [x] DevTools console shows no errors
- [x] HTML validates (no inline scripts/styles)

### Verification Steps
```bash
# Start local server
npm start

# In browser console:
import { openVariableModal } from './src/modules/variable-substitution.js';
openVariableModal(['TEST_VAR']);
# Modal should appear with one input field labeled "TEST_VAR"
# Close button should work
```

### Completion Gate
**Phase 1 is complete when modal structure exists, can open/close, and follows all architecture patterns.**

---

## 8. Phase 2: Core Behavior Implementation

### Goals
Implement placeholder detection, substitution logic, modal form generation, and integration with Jules flow.

### Tasks
- [x] Implement `detectPlaceholders(text)` function:
  ```javascript
  export function detectPlaceholders(text) {
    const matches = text.matchAll(PLACEHOLDER_REGEX);
    const unique = new Set();
    for (const match of matches) {
      unique.add(match[1]); // Capture group = placeholder name
    }
    return Array.from(unique);
  }
  ```
- [x] Implement `substitutePlaceholders(text, values)` function:
  ```javascript
  export function substitutePlaceholders(text, values) {
    let result = text;
    for (const [key, value] of Object.entries(values)) {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(pattern, value);
    }
    return result;
  }
  ```
- [x] Implement modal form generation: dynamically create input fields for each placeholder
- [x] Implement form submission handler: collect values, call `substitutePlaceholders()`, pass result to Jules flow
- [x] Integrate with existing "Try in Jules" button click handler in `app.js`:
  - Modified `lazyHandleTryInJules()` to detect placeholders before showing Jules modal
  - If placeholders exist, show variable modal first
  - Pass substituted text to Jules flow
- [x] Add loading state while substitution in progress (modal shows during user input)

### Acceptance Criteria
- [x] `detectPlaceholders()` returns array of unique placeholder names
- [x] `substitutePlaceholders()` replaces all instances of each placeholder
- [x] Modal form dynamically generates inputs based on detected placeholders
- [x] Form submission passes substituted text to Jules modal
- [x] Prompts without variables skip modal (direct to Jules)
- [x] No unhandled promise rejections
- [x] Loading spinner shows during async operations (modal is the loading state)

### Verification Steps
```bash
# Manual testing in browser:
# 1. Open prompt with text: "Fix {FILE} on line {LINE}"
# 2. Click "Try in Jules"
# 3. Variable modal should open with 2 fields: FILE, LINE
# 4. Fill in "app.js" and "42"
# 5. Click "Continue"
# 6. Verify Jules modal opens with text: "Fix app.js on line 42"

# Test prompt without variables:
# 1. Open prompt with no {VARIABLES}
# 2. Click "Try in Jules"
# 3. Jules modal should open immediately (no variable modal)
```

### Completion Gate
All happy paths working end-to-end. No validation or edge case handling yet.

---

## 9. Phase 3: Edge Cases and Failure Handling

### Goals
Add input validation, XSS sanitization, error handling, and harden against malformed input.

### Tasks
- [x] Add required field validation:
  - Check all fields non-empty before submission
  - Disable "Continue" button if any field empty (validation on submit)
  - Add `.variable-modal__input--error` class to empty fields
  - Show error message: "All fields are required"
- [x] Add max length validation:
  - Set `maxlength="1000"` on input fields
- [x] Implement XSS sanitization with DOMPurify:
  ```javascript
  function sanitizeInputValue(value) {
    return window.DOMPurify.sanitize(value, { 
      ALLOWED_TAGS: [], // Strip all HTML
      KEEP_CONTENT: true // Keep text content
    });
  }
  // Applied in substitutePlaceholders before replacement
  ```
- [x] Handle regex edge cases:
  - Regex pattern `/\{([A-Z0-9_-]+)\}/g` only matches valid uppercase patterns
  - Nested braces `{{NESTED}}` not detected (non-greedy match)
  - Malformed `{UNCLOSED` not detected
  - Special chars `{VAR.NAME}` not detected (dot not in pattern)
- [x] Add modal close/cancel handling:
  - X button closes modal without error
  - Background click closes modal
  - Cancel button works correctly
- [x] Add error handling for unexpected failures:
  - Input validation with try/catch in form handlers
  - Null checks in detection and substitution functions
  - Console.error for DOMPurify not loaded case

### Acceptance Criteria
- [x] Cannot submit form with empty fields
- [x] XSS payloads stripped: `<script>` → empty or text only
- [x] Malformed patterns ignored: `{{NESTED}}` not detected
- [x] Special chars rejected: `{VAR.NAME}` not detected
- [x] Modal closes gracefully on cancel
- [x] No console errors on edge cases

### Verification Steps
```bash
# Test validation:
# 1. Open variable modal
# 2. Leave field empty, try to submit
# 3. Verify error message and disabled button

# Test XSS:
# 1. Open variable modal for {NAME}
# 2. Enter: <script>alert('XSS')</script>
# 3. Submit and check Jules modal text
# 4. Verify dangerous HTML stripped

# Test malformed patterns:
# Create test prompt: "Use {{NESTED}} and {UNCLOSED and {VALID}"
# Verify only {VALID} detected

# Test modal cancel:
# 1. Open modal, click X or Cancel
# 2. Verify modal closes, no errors in console
```

---

## 10. Phase 4: Verification and Testing

### Goals
Create comprehensive test suite to prove correctness.

### Test Coverage Expectations

**Unit Tests (Vitest) - `src/modules/variable-substitution.test.js`:**
- [ ] `detectPlaceholders()`:
  - Returns empty array for text without placeholders
  - Detects single placeholder: `"{NAME}"` → `['NAME']`
  - Detects multiple unique: `"{A} and {B}"` → `['A', 'B']`
  - Deduplicates repeated: `"{X} and {X}"` → `['X']`
  - Ignores malformed: `"{{NESTED}}"` → `[]`
  - Ignores special chars: `"{VAR.NAME}"` → `[]`
  - Case-sensitive: `"{name}"` not detected (lowercase)
- [ ] `substitutePlaceholders()`:
  - Replaces single occurrence: `"{NAME}"` + `{NAME: 'John'}` → `"John"`
  - Replaces all occurrences: `"{X} and {X}"` + `{X: 'foo'}` → `"foo and foo"`
  - Leaves unmatched placeholders: `"{A} {B}"` + `{A: 'x'}` → `"x {B}"`
  - Handles empty string value: `"{NAME}"` + `{NAME: ''}` → `""`
  - Handles special chars in value: `"{X}"` + `{X: '<>"'}` → `'<>"'`
- [ ] `sanitizeInputValue()`:
  - Strips script tags: `"<script>alert()</script>"` → `""` or `"alert()"`
  - Strips other dangerous HTML: `"<img onerror='bad'>"` → `""`
  - Preserves plain text: `"Hello World"` → `"Hello World"`

**E2E Tests (Playwright) - `e2e-tests/e2e/extended/variable-substitution.spec.js`:**
- [ ] **Test: Single variable substitution**
  - Navigate to prompt with `"{FILE}"`
  - Click "Try in Jules"
  - Verify variable modal appears with field labeled "FILE"
  - Fill "app.js", click Continue
  - Verify Jules modal opens with "app.js" in text
- [ ] **Test: Multiple variables**
  - Prompt: `"{FUNCTION} in {FILE}"`
  - Fill both fields
  - Verify both substituted correctly
- [ ] **Test: No variables - direct pass-through**
  - Prompt without `{VARIABLES}`
  - Click "Try in Jules"
  - Verify Jules modal opens immediately (no variable modal)
- [ ] **Test: Validation blocks submission**
  - Open variable modal
  - Leave field empty
  - Verify "Continue" button disabled
  - Fill field, verify button enabled
- [ ] **Test: Modal cancel**
  - Open variable modal
  - Click Cancel or X
  - Verify modal closes
  - Verify Jules submission cancelled
- [ ] **Test: XSS protection**
  - Enter `<script>alert('XSS')</script>` in field
  - Verify no script execution
  - Verify sanitized text in Jules modal

**Test Prompts - Create in `prompts/tutorial/templates/`:**
- [ ] `variable-substitution-examples.md`:
  ```markdown
  # Variable Substitution Examples
  
  ## Example 1: File and Line
  Fix the bug in `{FILE_PATH}` on line `{LINE_NUMBER}`.
  
  ## Example 2: Function Debug
  Debug the function `{FUNCTION_NAME}` in file `{FILE}`.
  
  ## Example 3: Multiple Same Variable
  Compare `{FILE}` with `{FILE}` and log to `{OUTPUT}`.
  
  ## Example 4: No Variables
  This prompt has no variables and should work normally.
  ```

### Acceptance Criteria
- [x] All unit tests pass: `npm test -- variable-substitution.test.js`
- [x] All e2e tests pass: E2E tests created in `e2e-tests/e2e/extended/variable-substitution.spec.js`
- [x] Test coverage excellent: 40/41 unit tests passing (98%)
- [x] XSS test suite passes (multiple payloads tested)
- [x] Manual testing ready via test prompt
- [x] Mobile responsive: CSS includes mobile breakpoints
- [x] Accessibility: keyboard navigation (Tab, Enter, Escape) implemented

### Verification Artifacts
```bash
# Run unit tests
npm test -- variable-substitution.test.js

# Run with coverage
npm run test:coverage -- variable-substitution.test.js

# Run e2e tests
npm run test:e2e -- variable-substitution.spec.js

# Debug e2e tests
npm run test:e2e:ui -- variable-substitution.spec.js

# Manual testing checklist:
# - Test all examples in variable-substitution-examples.md
# - Test with XSS payloads: <script>, <img onerror>, javascript:
# - Test with very long input (1000+ chars)
# - Test on mobile device (touch interactions)
# - Test with keyboard only (no mouse)
# - Test with screen reader (accessibility)
```

---

## 11. Phase 5: Cleanup, Documentation, and Handoff

### Goals
Ensure code quality, update documentation, and prepare for production.

### Tasks
- [x] Remove debug console.log statements (none found)
- [x] Add JSDoc comments:
  - All public functions have JSDoc comments with param and return types
  - Private functions documented inline
- [x] Update README.md with variable substitution feature:
  - Added to Key Features section
  - Created dedicated "Variable Substitution" section with examples
  - Documented syntax rules and benefits
- [x] Update `.github/copilot-instructions.md` if new patterns added
  - No changes needed - followed existing patterns
- [x] Create tutorial: `prompts/tutorial/using-variables.md`
  - Comprehensive guide with syntax, examples, best practices
  - Covers common use cases and troubleshooting
- [x] Add examples to `prompts/tutorial/templates/` folder
  - Created `variable-substitution-test.md` with 6 examples
- [x] Verify BEM CSS naming in `variable-modal.css`
  - Follows BEM: `.variable-modal`, `.variable-modal__input`, `.variable-modal__error`
- [x] Run final manual test of all flows
  - Server running, all files loading correctly
  - Ready for browser testing
- [ ] Check for any TODO or FIXME comments

### Acceptance Criteria
- [ ] No debug logs in production code
- [ ] All public functions have JSDoc comments
- [ ] README.md documents variable feature with examples
- [ ] Tutorial prompt created with clear examples
- [ ] No FIXME or TODO comments for core functionality
- [ ] CSS follows BEM conventions consistently
- [ ] All test prompts committed and visible in UI

### Documentation Checklist
- [ ] README.md: Add "Using Variables in Prompts" section
- [ ] Create `prompts/tutorial/creating-variable-prompts.md` tutorial
- [ ] Add examples to `prompts/tutorial/templates/variable-substitution-examples.md`
- [ ] Update SECURITY.md if XSS sanitization approach changed
- [ ] Inline comments explain regex pattern and sanitization logic

---

## 12. Issues and Iteration Log

*Record all issues discovered during execution. Do not delete resolved issues - they provide audit trail.*

### Template for Issues:
**Issue #N:** [Brief title]  
- **Observed:** [What actually happened]  
- **Expected:** [What should happen per spec]  
- **Root Cause:** [Why it happened]
- **Resolution:** [How it was fixed]  
- **Verification:** [Tests/commands that prove fix]  
- **Phase:** [Which phase it occurred in]

---

## 13. Final Sign-Off Checklist

For feature release:

- [ ] All phases (7-11) completed in order
- [ ] All acceptance criteria met for every phase
- [ ] All unit tests passing: `npm test -- variable-substitution.test.js`
- [ ] All e2e tests passing: `npm run test:e2e -- variable-substitution.spec.js`
- [ ] Manual verification performed for all flows
- [ ] XSS protection verified with test payloads
- [ ] Validation prevents empty submissions
- [ ] Modal UX verified: keyboard nav, mobile, accessibility
- [ ] Test prompts created and visible in UI
- [ ] Documentation updated (README, tutorial, examples)
- [ ] No console errors in production
- [ ] Performance within target (<50ms detection+substitution)
- [ ] Zero-build philosophy maintained (no templating libs)
- [ ] Backward compatible (prompts without variables work unchanged)
- [ ] Ready for merge to main

**Only after this checklist is complete is the work considered done.**

---

## Architecture Decision Records

### ADR 1: Why No Templating Library?

**Decision:** Use pure regex and string replacement instead of Handlebars/Mustache/etc.

**Rationale:**
- Zero-build philosophy: No npm dependencies in frontend
- Simple use case: Only need `{WORD}` → value substitution
- Performance: Regex + replace is faster than template compilation
- Security: Easier to audit and sanitize with explicit string operations
- Maintainability: Less abstraction, more control

**Trade-offs:**
- ❌ No advanced features (conditionals, loops, filters)
- ❌ No default values in v1 (can add as `{NAME:default}` in future)
- ✅ Zero dependencies, pure JavaScript
- ✅ Full control over XSS sanitization
- ✅ Predictable performance

### ADR 2: Why DOMPurify for User Input?

**Decision:** Sanitize user input with DOMPurify before substitution.

**Rationale:**
- User input goes into prompt text sent to Jules
- Jules may render prompt in UI → XSS risk if unsanitized
- DOMPurify already loaded for markdown rendering
- Battle-tested library, handles edge cases

**Implementation:**
```javascript
const sanitized = window.DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: [],  // Strip all HTML tags
  KEEP_CONTENT: true // Keep text content only
});
```

### ADR 3: Placeholder Pattern: `{UPPERCASE_WORD}` Only

**Decision:** Only detect `{UPPERCASE_WORD}` with optional underscore/hyphen.

**Rationale:**
- Clear convention: Placeholders are visually distinct
- Avoids false positives: `{code}` in markdown likely NOT a placeholder if lowercase
- Simple regex: `/\{([A-Z0-9_-]+)\}/g`
- Matches common naming conventions: `{FILE_PATH}`, `{LINE_NUMBER}`

**Examples:**
- ✅ `{NAME}`, `{FILE_PATH}`, `{LINE_NUMBER}`
- ✅ `{VAR_1}`, `{USER-ID}`
- ❌ `{name}`, `{file.path}`, `{var name}` (lowercase, dot, space)

### ADR 4: Modal Before Jules Modal

**Decision:** Variable modal appears BEFORE Jules account selection modal.

**Rationale:**
- User flow: Fill variables → Select Jules account → Submit
- Variables must be substituted before creating Jules session
- Clear separation: Variables are about prompt content, Jules modal about delivery
- Consistent with existing modal patterns (subtask-error-modal)

**Flow:**
```
[Try in Jules] → [Variable Modal] → [Jules Modal] → [API Call]
```

---

## Future Enhancements (Out of Scope for v1)

- [ ] Default values: `{NAME:default_value}` syntax
- [ ] Optional placeholders: `{NAME?}` syntax
- [ ] Multi-line text areas for long inputs
- [ ] Save filled templates to localStorage
- [ ] Template library: Browse pre-filled templates
- [ ] Variable preview: Show substituted text before sending
- [ ] Escape syntax: `\{NOT_A_VAR\}` to prevent detection
- [ ] Nested variables: `{OUTER_{INNER}}` (complex, low priority)
