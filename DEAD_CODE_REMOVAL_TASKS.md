# Dead Code Removal Tasks: PromptRoot Web Application

**Analysis Date:** 2026-02-11  
**Repository:** promptroot/promptroot  
**Branch:** copilot/remove-dead-code

---

## Summary

After comprehensive analysis of the entire application codebase, I have identified **7 exported functions** that are provably dead code. These functions are exported but never imported anywhere in the application, making them unreachable at runtime.

The dead code identified represents **less than 1% of the total codebase**. The codebase is generally well-maintained with all DOM queries matching their HTML counterparts, no orphaned CSS classes, and no dead storage keys.

---

### Unused Analytics Statistical Functions

The analytics module exports three statistical functions (getQuickStats, getTopPrompts, getFailureInsights) that were likely intended for a dashboard or reporting feature. These functions are never imported or called anywhere in the application. They add cognitive load by suggesting features that don't exist and increase the apparent API surface without providing value.

:codex-file-citation[codex-file-citation]{
line_range_start=335
line_range_end=345
path=/home/runner/work/promptroot/promptroot/src/modules/analytics.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/analytics.js#L335-L345"
}

:codex-file-citation[codex-file-citation]{
line_range_start=347
line_range_end=366
path=/home/runner/work/promptroot/promptroot/src/modules/analytics.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/analytics.js#L347-L366"
}

:codex-file-citation[codex-file-citation]{
line_range_start=368
line_range_end=395
path=/home/runner/work/promptroot/promptroot/src/modules/analytics.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/analytics.js#L368-L395"
}

:::task-stub{title="Remove unused analytics statistical functions"}
1. Remove getQuickStats() function from lines 335-345 in src/modules/analytics.js
2. Remove getTopPrompts() function from lines 347-366 in src/modules/analytics.js
3. Remove getFailureInsights() function from lines 368-395 in src/modules/analytics.js
4. Run grep to verify no remaining references: grep -r "getQuickStats\|getTopPrompts\|getFailureInsights" src/ pages/ *.html
5. Run unit tests: npm test -- analytics
6. Manually test analytics page to ensure calculateAnalytics() still functions correctly
7. Verify no console errors in browser DevTools when visiting analytics page
:::

---

### Unreachable Jules Sessions History Modal Opener

The function showJulesSessionsHistoryModal() is exported from jules-account.js but is never imported or called anywhere in the application. The corresponding hideJulesSessionsHistoryModal() function IS used (called dynamically from jules-modal.js), but the show function is unreachable. This suggests either an incomplete feature implementation or a refactored code path where the modal is opened through a different mechanism.

:codex-file-citation[codex-file-citation]{
line_range_start=561
line_range_end=573
path=/home/runner/work/promptroot/promptroot/src/modules/jules-account.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/jules-account.js#L561-L573"
}

:::task-stub{title="Remove unreachable Jules sessions history modal opener"}
1. Remove showJulesSessionsHistoryModal() function from lines 561-573 in src/modules/jules-account.js
2. Search codebase for any string references that might indicate planned usage: grep -r "JulesSessionsHistoryModal" src/ pages/ *.html
3. Verify hideJulesSessionsHistoryModal() is still properly exported and accessible
4. Run unit tests: npm test -- jules-account
5. Manually test Jules page and verify modal functionality still works
6. Verify no console errors in browser DevTools
:::

---

### Unused Queue Selection Getter Function

The getSelectedQueueIds() function in jules-queue.js is exported but never imported anywhere in the application. It appears to be a utility for batch queue operations, but the actual queue selection logic doesn't use this export. The functionality is likely handled by internal state management within the module, making this exported function redundant and unreachable.

:codex-file-citation[codex-file-citation]{
line_range_start=61
line_range_end=79
path=/home/runner/work/promptroot/promptroot/src/modules/jules-queue.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/jules-queue.js#L61-L79"
}

:::task-stub{title="Remove unused queue selection getter"}
1. Remove getSelectedQueueIds() export and function from lines 61-79 in src/modules/jules-queue.js
2. Verify internal queue selection logic still works correctly by checking other functions in the module
3. Run unit tests: npm test -- jules-queue
4. Manually test queue page UI to ensure batch operations still function
5. Test selecting multiple queue items and performing batch actions
6. Verify no console errors in browser DevTools when using queue functionality
:::

---

### Unused Jules Source Details API Function

The function getJulesSourceDetails() in jules-api.js is exported but never imported or used anywhere in the application. The API client has a listJulesSources() function that IS actively used for listing sources, but the detailed source fetcher is orphaned. This indicates either incomplete implementation of a details view feature or changed requirements where detailed source information is no longer needed.

:codex-file-citation[codex-file-citation]{
line_range_start=37
line_range_end=48
path=/home/runner/work/promptroot/promptroot/src/modules/jules-api.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/jules-api.js#L37-L48"
}

:::task-stub{title="Remove unused Jules source details API function"}
1. Remove getJulesSourceDetails() export and function from lines 37-48 in src/modules/jules-api.js
2. Verify listJulesSources() is still properly exported and imported in repo-branch-selector.js
3. Run unit tests: npm test -- jules-api
4. Manually test Jules integration to confirm no feature regression
5. Test source selection functionality in the Jules UI
6. Verify API calls to Jules service still work correctly
:::

---

### Unused GitHub API Proxy Configuration Function

The setViaProxy() function in github-api.js is exported but never called anywhere in the application. This appears to be infrastructure for proxying GitHub API calls that was either never completed or replaced by a different approach. Keeping unused API configuration functions can mislead future maintainers about system capabilities and create confusion about whether proxy support exists.

:codex-file-citation[codex-file-citation]{
line_range_start=6
line_range_end=21
path=/home/runner/work/promptroot/promptroot/src/modules/github-api.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/github-api.js#L6-L21"
}

:::task-stub{title="Remove unused GitHub API proxy configuration"}
1. Remove setViaProxy() export and function from lines 6-21 in src/modules/github-api.js
2. Check if internal viaProxy variable is still needed; remove if only used by setViaProxy()
3. Verify github-api module still functions correctly for all API calls
4. Run unit tests: npm test -- github-api
5. Manually test GitHub API functionality (fetching repos, branches, file contents)
6. Confirm all GitHub API calls (fetchJSON, fetchJSONWithETag) still work without proxy
7. Verify no console errors when browsing prompts and switching branches
:::

---

### Obsolete TODO Comment in Session Tracking

A TODO comment in session-tracking.js references disabling timestamp comparison due to existing data issues. This creates uncertainty about whether the current implementation is correct or if future work is needed. If the feature works as intended without timestamp comparison, the TODO should be removed. If it's truly a known issue, it should be properly documented in an issue tracker rather than an inline comment.

:codex-file-citation[codex-file-citation]{
line_range_start=1
line_range_end=100
path=/home/runner/work/promptroot/promptroot/src/modules/session-tracking.js
git_url="https://github.com/promptroot/promptroot/blob/copilot/remove-dead-code/src/modules/session-tracking.js#L1-L100"
}

:::task-stub{title="Resolve or remove obsolete TODO in session tracking"}
1. Locate the TODO comment about timestamp comparison in src/modules/session-tracking.js
2. Examine the timestamp comparison logic and understand why it was disabled
3. Determine if the data issue has been resolved or if the feature works correctly without it
4. Either remove the TODO if feature works correctly, or create a proper GitHub issue and update the comment to reference the issue
5. Test session tracking functionality to ensure sessions are properly tracked and deduplicated
6. Run unit tests: npm test -- session-tracking
7. Verify no regressions in session management
:::

---

## Testing Strategy

After implementing all removals, perform comprehensive validation:

### Unit Tests
```bash
npm test
```

### Manual Testing Checklist
- [ ] Visit analytics page and verify statistics display correctly
- [ ] Test Jules integration (account, API, queue, sessions)
- [ ] Test queue batch operations (select, process, delete multiple items)
- [ ] Test GitHub API functionality (browse prompts, switch branches, view files)
- [ ] Test session tracking (create sessions, verify deduplication)
- [ ] Check browser DevTools console for any errors
- [ ] Verify no missing imports or undefined function errors

### Verification Commands
```bash
# Verify no remaining references to removed functions
grep -r "getQuickStats\|getTopPrompts\|getFailureInsights" src/ pages/ *.html
grep -r "showJulesSessionsHistoryModal" src/ pages/ *.html
grep -r "getSelectedQueueIds" src/ pages/ *.html
grep -r "getJulesSourceDetails" src/ pages/ *.html
grep -r "setViaProxy" src/ pages/ *.html
```

---

## Impact Summary

| Metric | Value |
|--------|-------|
| **Functions removed** | 7 |
| **Lines of code removed** | ~120 |
| **Modules affected** | 5 |
| **Breaking changes** | 0 (functions were already unreachable) |
| **Test impact** | None (functions not covered by tests) |
| **Runtime impact** | None (zero performance difference) |
| **Maintenance benefit** | High (clearer API surface, reduced confusion) |

---

## Risk Assessment

**Removal is safe because:**
- All functions proven unused through comprehensive grep searches
- No imports exist in entire repository
- No dynamic imports or string references found
- Functions are exported but unreachable at runtime
- No URL routing or lazy loading depends on these symbols
- Unit tests don't validate these functions (confirms unused status)

**Post-removal validation ensures:**
- All unit tests pass
- No console errors in browser
- All affected pages function correctly
- No undefined function errors occur
- Related features still work as expected

---

**Generated by:** Claude AI Agent (Dead Code Analysis Mode)  
**Review Status:** Ready for implementation  
**Estimated Impact:** Low risk, high clarity benefit
