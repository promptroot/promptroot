# Execution Roadmap Tasks - README

## Overview

This directory contains 10 granular tasks following the **Specification-Driven Execution Roadmap** template for the PromptRoot project. These tasks serve as a comprehensive guide for implementing new features in a zero-build, vanilla JavaScript environment with Firebase backend.

## Files Provided

1. **EXECUTION_ROADMAP_TASKS.md** - Markdown format with codex-file-citation syntax
   - Ideal for integration with documentation systems
   - Contains structured citations to codebase
   - Follows the grammar specification from the problem statement

2. **EXECUTION_ROADMAP_TASKS_PLAIN.txt** - Plain text format
   - Easy to copy and paste
   - Human-readable without special formatting
   - Quick reference for terminal/CLI workflows

## Task Structure

Each task follows a consistent structure:

```
### Task Title

Rationale paragraph (1-3 sentences explaining why this task matters)

Citations: (Links to relevant code in the repository)
- path/to/file.js lines X-Y

Task Steps: (7 actionable steps)
1. First step
2. Second step
...
7. Final verification step
```

## The 10 Tasks

### Phase 1: Foundation / Scaffolding

1. **Establish Firebase Environment Configuration**
   - Verify dev/prod Firebase environments
   - Port-based detection (5000 = emulators, 3000 = production)

2. **Define Feature Constants and Configuration**
   - Centralize all magic strings in `src/utils/constants.js`
   - Follow UPPER_SNAKE_CASE naming

3. **Create Firestore Data Model and Security Rules**
   - Design collections and security rules
   - Enforce user-only data access patterns

4. **Scaffold Module Files with Named Exports**
   - Create empty module files in `src/modules/`
   - One feature per module pattern

### Phase 2: Core Implementation

5. **Implement DOM Manipulation Using Helper Functions**
   - Use DOM APIs and helpers from `src/utils/dom-helpers.js`
   - No HTML strings or inline styles

6. **Integrate Firebase Authentication State Listener**
   - Setup auth state management
   - Use `waitForFirebase()` pattern

7. **Implement Session Caching for API Responses**
   - Add caching with TTL support
   - LRU eviction strategy

8. **Create Page Initialization Module**
   - Build page-specific init files in `src/pages/`
   - Wait for shared components pattern

### Phase 3: Testing & Error Handling

9. **Write Unit Tests with Vitest and jsdom**
   - Create tests in `src/unit-tests/`
   - Meet coverage thresholds (10% lines, 24% functions)

10. **Implement Error Handling with Error Handler Utility**
    - Centralized error handling
    - Categorize errors (AUTH, NETWORK, VALIDATION)

## Usage

### For Developers

1. Read the task title and rationale to understand the goal
2. Review the citations to see real examples in the codebase
3. Follow the 7 steps in order for each task
4. Verify completion after each step

### For Project Managers

- Use these tasks to create Jira tickets, GitHub issues, or sprint items
- Each task is sized for approximately 2-4 hours of work
- Tasks are ordered in logical dependency sequence
- All tasks reference existing code patterns for consistency

### For AI Assistants

- These tasks provide clear context and examples from the codebase
- Citations link to specific files and line ranges
- Step-by-step instructions reduce ambiguity
- Verification steps help confirm completion

## Architecture Principles

All tasks adhere to PromptRoot's core principles:

- ✅ **Zero-Build**: No transpilation, bundlers, or build steps
- ✅ **Named Exports Only**: No default exports
- ✅ **No HTML in JavaScript**: Use DOM APIs only
- ✅ **No Inline Styles**: CSS classes only
- ✅ **Module-Scoped State**: Private variables within modules
- ✅ **BEM CSS Naming**: `.component__element--modifier`

## Related Documentation

- `docs/CODE_STYLE_GUIDE.md` - JavaScript/CSS coding standards
- `docs/UI_GUIDELINES.md` - UI/UX design patterns
- `CLAUDE.md` - Project overview and development workflows
- `FORKING_GUIDE.md` - Guide for forking the repository

## Questions?

If you need clarification on any task:
1. Check the citations for real-world examples in the codebase
2. Review the related documentation files
3. Search for similar patterns in `src/modules/` or `src/utils/`

---

**Generated:** 2026-02-08  
**Repository:** promptroot/promptroot  
**License:** MIT
