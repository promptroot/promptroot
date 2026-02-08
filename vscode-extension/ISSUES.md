# Promptroot VS Code Extension Issues

This file tracks issues, bugs, and blockers discovered during development.

## Issue Template

### Issue #N: [Title]
**Status:** Open/In Progress/Resolved  
**Severity:** Critical/High/Medium/Low  
**Phase:** Phase N  
**Date Reported:** YYYY-MM-DD

**Description:**
Brief description of the issue.

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. ...

**Expected Behavior:**
What should happen.

**Actual Behavior:**
What actually happens.

**Environment:**
- VS Code Version: 
- Extension Version: 
- OS: 
- Node Version:

**Logs/Screenshots:**
Any relevant logs, error messages, or screenshots.

**Resolution:**
How the issue was resolved (if applicable).

---

## Open Issues

None.

## Resolved Issues

### Issue #1: Preview Document Close Error
**Status:** Resolved  
**Severity:** High  
**Phase:** Phase 5  
**Date Reported:** 2026-02-08  
**Date Resolved:** 2026-02-08

**Description:**
When creating a new prompt asset, the preview document close operation attempted to save the untitled document to disk, resulting in a permissions error.

**Steps to Reproduce:**
1. Run "Promptroot: Create New Prompt Asset"
2. Complete metadata entry
3. Click "Create" in confirmation dialog
4. Extension crashes with: `Unable to write file '\test.md' (NoPermissions)`

**Expected Behavior:**
Preview closes without attempting to save, file created in prompts directory.

**Actual Behavior:**
VS Code attempted to save the modified untitled document to C:\test.md, causing permission error.

**Environment:**
- VS Code Version: 1.108.2
- Extension Version: 0.1.0
- OS: Windows
- Node Version: 20.17.0

**Resolution:**
Changed `workbench.action.closeActiveEditor` to `workbench.action.revertAndCloseActiveEditor` in `asset-creator.ts` confirmFileCreation function. This reverts the document (discarding changes) before closing, preventing VS Code from attempting to save.
