# Phase 8 Verification Guide: Jules Queue Management

This guide will help you test and verify the Jules Queue Management features implemented in Phase 8.

## Overview

Phase 8 adds queue management capabilities to the VS Code extension, allowing users to:
- View queue items in a tree view with real-time synchronization
- Add prompts to the Jules queue
- Manage queue items (pause, resume, delete)
- Execute queue items
- View batch operations with subtasks

**Current Status:** 20/30 tasks complete (67%)

---

## Prerequisites

Before testing Phase 8, ensure:

1. **Phase 7 is working:**
   - You can sign in with GitHub
   - Firebase connection is established
   - User profile is created in Firestore

2. **Development environment is set up:**
   - Run `npm install` in vscode-extension folder
   - Run `npm run compile` (should complete with 0 errors)
   - Have a workspace open with some markdown files

3. **Firebase project is configured:**
   - Using production Firebase or emulators
   - Firestore rules allow user data access
   - Authentication is working

---

## Testing Checklist

### ✅ Phase 8.1: Queue Tree View

**What to Test:**
- Queue view appears in VS Code sidebar
- Real-time synchronization with Firestore
- Status icons display correctly
- Queue items show proper metadata

**Steps:**

1. **Open the Queue View:**
   - Launch extension with F5
   - Look for "JULES QUEUE" view in the Explorer sidebar
   - Should show "Sign in to view queue" if not signed in

2. **Sign In:**
   - Click status bar or run "Promptroot: Sign In"
   - Authenticate with GitHub
   - Queue view should update to show empty state or existing items

3. **Verify Real-Time Sync:**
   - Add a queue item (see section 8.2 below)
   - Queue view should update automatically without refresh
   - Status changes should reflect immediately

4. **Check Status Icons:**
   - Pending items: 📝 icon
   - Running items: ▶️ icon with spinning animation
   - Completed items: ✅ icon with green color
   - Failed items: ❌ icon with red color
   - Paused items: ⏸️ icon
   - Scheduled items: 📅 icon

**Expected Results:**
- ✅ Queue view displays correctly
- ✅ Real-time updates work without manual refresh
- ✅ Icons match item status
- ✅ Tooltips show full item details

---

### ✅ Phase 8.2: Add to Queue Commands

**What to Test:**
- "Send to Jules Queue" command
- Branch name input UI
- Single prompt submission
- Validation

**Steps:**

1. **Add Prompt via Command:**
   - Open a markdown file (e.g., `prompts/tutorial/hello.md`)
   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
   - Type "Promptroot: Add to Jules Queue"
   - Enter branch name when prompted (default suggested: `jules-YYYY-MM-DD-HH-MM-SS`)
   - Click OK

2. **Add Prompt via Context Menu:**
   - Right-click a .md file in file explorer
   - Select "Promptroot: Add to Jules Queue"
   - Enter branch name
   - Confirm

3. **Test Validation:**
   - Try adding a non-markdown file
   - Should show warning: "Only markdown (.md) files can be added to the queue"
   - Try running command without workspace open
   - Should show error about no workspace

4. **Check Queue View:**
   - Added item should appear in JULES QUEUE view
   - Status should be "pending"
   - Tooltip should show: prompt path, branch, created time

**Expected Results:**
- ✅ Command works from command palette
- ✅ Command works from context menu
- ✅ Branch name input shows suggested value
- ✅ Only .md files can be added
- ✅ Item appears in queue immediately
- ✅ Notification confirms addition

**Not Yet Implemented:**
- ❌ Batch prompt submission (multiple files at once)
- ❌ Repository selection UI (currently uses 'vscode-extension' as sourceId)

---

### ✅ Phase 8.3: Queue Item Management

**What to Test:**
- Delete queue item
- Pause/Resume queue item
- Context menu on queue items

**Steps:**

1. **Delete Queue Item:**
   - Right-click a queue item in JULES QUEUE view
   - Select "Promptroot: Delete Queue Item"
   - Confirm deletion in modal
   - Item should disappear from queue

2. **Pause Queue Item:**
   - Right-click a pending queue item
   - Select "Promptroot: Pause Queue Item"
   - Status should change to "paused"
   - Icon should change to ⏸️

3. **Resume Queue Item:**
   - Right-click a paused queue item
   - Select "Promptroot: Resume Queue Item"
   - Status should change back to "pending"
   - Icon should change to 📝

4. **Verify Context Menus:**
   - Right-click different item types (pending, paused, completed)
   - Check that appropriate commands are available
   - Info items should not show action commands

**Expected Results:**
- ✅ Delete works with confirmation
- ✅ Pause changes status to "paused"
- ✅ Resume changes status to "pending"
- ✅ Status changes sync in real-time
- ✅ Notifications confirm actions

**Not Yet Implemented:**
- ❌ Edit queue item command
- ❌ View queue item details command
- ❌ Duplicate queue item
- ❌ Multi-select operations
- ❌ Clear completed/failed items commands

---

### ✅ Phase 8.4: Queue Execution

**What to Test:**
- Run queue item command
- Progress notifications
- Status updates
- Error handling

**Steps:**

1. **Run Single Queue Item:**
   - Right-click a pending queue item
   - Select "Promptroot: Run Queue Item" (▶️ icon)
   - Should show progress notification: "Running queue item..."
   - Watch status change: pending → running → completed
   - Should take ~2 seconds (simulated execution)

2. **Verify Status Updates:**
   - While running, icon should be ▶️ with spinning animation
   - After completion, icon should be ✅ with green color
   - Tooltip should show updated timestamp

3. **Test Error Handling:**
   - Manually modify queue item in Firestore to cause error
   - Or test with item that references non-existent file
   - Should show error notification
   - Status should change to "failed"
   - Icon should be ❌ with red color
   - Tooltip should show error message

**Expected Results:**
- ✅ Run command executes queue item
- ✅ Progress notification displays
- ✅ Status updates in real-time (pending → running → completed)
- ✅ Completed notification shows
- ✅ Errors are caught and displayed

**Current Limitations:**
- ⚠️ Execution is SIMULATED (not real Jules API yet)
- ⚠️ Uses 2-second delay instead of actual API call
- ⚠️ No session creation or PR generation

**Not Yet Implemented:**
- ❌ Real Jules API integration (createSession)
- ❌ "Run Next Pending" command
- ❌ "Run All Pending" command
- ❌ Execution logs/output display

---

### ✅ Phase 8.5: Batch Operations

**What to Test:**
- Batch item display in tree
- Subtask viewing
- Subtask status tracking

**Steps:**

1. **Create Batch Item in Firestore:**
   - Since batch submission UI not implemented yet, manually create in Firestore console:
   ```json
   {
     "type": "batch",
     "status": "pending",
     "sourceId": "vscode-extension",
     "branch": "jules-batch-test",
     "subtasks": [
       {
         "promptPath": "prompts/test1.md",
         "status": "pending"
       },
       {
         "promptPath": "prompts/test2.md",
         "status": "completed"
       },
       {
         "promptPath": "prompts/test3.md",
         "status": "failed",
         "error": "Test error"
       }
     ],
     "completedCount": 1,
     "failedCount": 1,
     "createdAt": Timestamp.now(),
     "updatedAt": Timestamp.now()
   }
   ```

2. **View Batch in Tree:**
   - Batch item should appear as "Batch (3 items)"
   - Should be expandable/collapsible
   - Click to expand

3. **View Subtasks:**
   - Expand batch item
   - Should show 3 subtasks with individual status icons
   - Each subtask shows: icon, prompt path, status
   - Tooltips show details including errors

4. **Check Status Tracking:**
   - Subtask icons should match their status
   - Failed subtasks should show error in tooltip

**Expected Results:**
- ✅ Batch items display with item count
- ✅ Batch items are expandable
- ✅ Subtasks display under batch parent
- ✅ Subtask status icons are correct
- ✅ Error messages visible in tooltips

**Not Yet Implemented:**
- ❌ Batch prompt submission UI
- ❌ Selective subtask execution
- ❌ Individual subtask failure handling
- ❌ "Retry Failed Subtasks" command
- ❌ Progress tracking (X/Y complete)

---

## Known Issues & Limitations

### Current Limitations

1. **No Real Jules API Integration:**
   - Queue execution is simulated (2 second delay)
   - No actual session creation
   - No PR generation or code changes
   - Will be implemented in Phase 11

2. **Batch Operations Incomplete:**
   - No UI to create batch submissions
   - Can't select multiple files at once
   - Must manually create batches in Firestore for testing

3. **Missing Advanced Features:**
   - No edit queue item UI
   - No queue item details view
   - No duplicate functionality
   - No bulk operations (clear all, run all)

4. **Repository Management:**
   - sourceId hardcoded to "vscode-extension"
   - No repository selection UI
   - Will connect to GitHub API in Phase 11

### Testing Notes

- **Firebase Emulator:** If using emulators, ensure they're running before testing
- **Real-time Sync:** Requires active Firestore connection
- **Error Recovery:** If Firestore connection fails, restart extension
- **Data Persistence:** Queue items persist across extension reloads

---

## Troubleshooting

### Queue View Shows "Sign in to view queue"

**Cause:** Not authenticated with GitHub

**Fix:**
1. Click status bar or run "Promptroot: Sign In"
2. Complete GitHub OAuth flow
3. Queue view should update automatically

### Queue View Shows Empty

**Cause 1:** No items in queue yet

**Fix:** Add a prompt to queue using "Add to Jules Queue" command

**Cause 2:** Firestore connection issues

**Fix:**
1. Check Firebase config in settings (Command Palette → Preferences: Open Settings (JSON))
2. Verify `promptroot.firebase.projectId` is correct
3. Check Output panel (View → Output → Promptroot) for errors
4. Restart extension

### Queue Items Not Updating in Real-Time

**Cause:** Firestore listener not attached

**Fix:**
1. Check Output panel for "Subscribed to queue for user: [uid]" message
2. If missing, sign out and sign in again
3. Check for Firestore errors in Output panel
4. Verify Firestore rules allow read access

### "Run Queue Item" Does Nothing

**Cause:** Command executed on info item (not actual queue item)

**Fix:** Only run on actual queue items (not "Sign in" or "No items" messages)

### Add to Queue Fails with "No workspace folder"

**Cause:** No VS Code workspace is open

**Fix:**
1. Open a folder in VS Code (File → Open Folder)
2. Ensure folder contains markdown files
3. Try command again

---

## Next Steps

After verifying Phase 8 features work:

### Complete Remaining Phase 8 Tasks (10 remaining):

1. **Batch Submission UI:**
   - Add command to select multiple markdown files
   - Create batch from selection
   - Show confirmation with list of files

2. **Edit Queue Item:**
   - Add command to edit branch name
   - Add command to edit scheduled time (if scheduled)
   - Update Firestore on save

3. **Jules API Integration:**
   - Connect "Run Queue Item" to real Jules API
   - Call createSession with prompt content
   - Store session ID in queue item
   - Update status based on session state

4. **Bulk Operations:**
   - "Run Next Pending" - executes first pending item
   - "Run All Pending" - executes all pending in sequence
   - "Clear Completed Items" - removes all completed
   - "Clear Failed Items" - removes all failed

5. **Advanced View:**
   - Queue item details WebView with full metadata
   - Duplicate queue item command
   - Multi-select in tree view

### Move to Phase 9: Queue Scheduling

Once Phase 8 is complete:
- Scheduling UI (date/time picker WebView)
- Timezone management
- Cloud Functions for auto-activation
- Scheduled item indicators

---

## Success Criteria

Phase 8 is considered complete when:

- ✅ Queue tree view displays all item types correctly
- ✅ Real-time sync works without manual refresh
- ✅ Add to queue works for single prompts
- ✅ Pause/Resume/Delete operations work
- ✅ Run command executes items (simulated or real)
- ✅ Batch items display with expandable subtasks
- ✅ Error handling works for all operations
- ✅ All 30 tasks in Phase 8 checklist are complete
- ✅ Extension compiles with 0 errors
- ✅ No console errors during normal operations

**Current Status:** 20/30 tasks complete - Phase 8 is 67% complete

---

## Additional Resources

- [ROADMAP_PART_2.md](./ROADMAP_PART_2.md) - Full Phase 8 specifications
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Task-by-task checklist
- [models.ts](./src/models.ts) - TypeScript interfaces for queue items
- [queue-tree-provider.ts](./src/queue-tree-provider.ts) - Tree view implementation
- [queue-manager.ts](./src/queue-manager.ts) - Queue operations logic

---

**Last Updated:** February 8, 2026
**Phase Status:** In Progress (20/30 tasks)
**Next Phase:** Phase 8 completion, then Phase 9 (Queue Scheduling)
