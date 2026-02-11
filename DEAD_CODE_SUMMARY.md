# Dead Code Removal Quick Reference

## 7 Functions to Remove

### 1. Analytics Functions (src/modules/analytics.js)
```javascript
// Lines 335-345: Remove getQuickStats()
// Lines 347-366: Remove getTopPrompts()
// Lines 368-395: Remove getFailureInsights()
```

### 2. Jules Session Modal (src/modules/jules-account.js)
```javascript
// Lines 561-573: Remove showJulesSessionsHistoryModal()
```

### 3. Queue Helper (src/modules/jules-queue.js)
```javascript
// Lines 61-79: Remove getSelectedQueueIds()
```

### 4. Jules API (src/modules/jules-api.js)
```javascript
// Lines 37-48: Remove getJulesSourceDetails()
```

### 5. GitHub API (src/modules/github-api.js)
```javascript
// Lines 6-21: Remove setViaProxy()
```

### 6. TODO Comment (src/modules/session-tracking.js)
```javascript
// Remove: "TODO: Re-enable timestamp comparison after fixing existing data"
```

## Verification Commands

```bash
# After each removal, verify no remaining references:
grep -r "getQuickStats" src/ pages/ *.html
grep -r "getTopPrompts" src/ pages/ *.html
grep -r "getFailureInsights" src/ pages/ *.html
grep -r "showJulesSessionsHistoryModal" src/ pages/ *.html
grep -r "getSelectedQueueIds" src/ pages/ *.html
grep -r "getJulesSourceDetails" src/ pages/ *.html
grep -r "setViaProxy" src/ pages/ *.html

# Run tests
npm test

# Test affected pages
# - Analytics page
# - Jules page
# - Queue page
# - Sessions page
```

## Impact
- **~120 lines removed**
- **7 unused exports eliminated**
- **Zero breaking changes** (functions already unreachable)
- **<1% of codebase affected**

See DEAD_CODE_ANALYSIS.md for full details.
