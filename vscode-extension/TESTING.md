# Promptroot VS Code Extension - Testing Guide

**Version:** 1.0  
**Last Updated:** February 10, 2026  
**Test Coverage:** 84 passing tests, 10.19% overall coverage (targeted coverage on critical modules)

---

## Table of Contents

1. [Quick Start Testing](#quick-start-testing)
2. [Prerequisites](#prerequisites)
3. [Unit Testing](#unit-testing)
4. [Manual Testing Workflows](#manual-testing-workflows)
5. [Firebase Testing](#firebase-testing)
6. [Error Handling Testing](#error-handling-testing)
7. [Performance Testing](#performance-testing)
8. [Regression Testing Checklist](#regression-testing-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start Testing

### 1. Install Dependencies
```bash
cd vscode-extension
npm install
```

### 2. Run Unit Tests
```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report
```

### 3. Launch Extension Development Host
```bash
# Option 1: From terminal
npm run compile && code --extensionDevelopmentPath=$PWD

# Option 2: From VS Code
# Press F5 or click "Run Extension" in Run & Debug panel
```

### 4. Verify Basic Functionality
1. Open test workspace: `C:\Users\jesse\prompt-sharing`
2. Look for "PROMPTROOT ASSETS" in Explorer sidebar
3. Press `Ctrl+Shift+P` → "Promptroot: Sign In"
4. Check Output panel (View → Output → "Promptroot")

---

## Prerequisites

### Required Software
- **VS Code:** 1.85.0 or higher
- **Node.js:** 20.x or higher
- **npm:** 10.x or higher
- **Git:** For version control

### Test Accounts
- **GitHub Account:** For OAuth testing
- **Firebase Project:** `promptroot-b02a2` (or test project)
- **Jules API Key:** Optional, for Jules API testing

### Test Data
- **Workspace with prompts:** `C:\Users\jesse\prompt-sharing` (has `prompts/` directory)
- **Empty workspace:** Any folder without `prompts/` directory
- **Sample prompts:** Create test `.md` files in `prompts/` folder

### Environment Setup

#### Production Firebase (Default)
```json
// No configuration needed - uses production by default
{
  "promptroot.firebase.useEmulator": false
}
```

#### Firebase Emulators (Development)
```json
// Add to VS Code settings.json
{
  "promptroot.firebase.useEmulator": true,
  "promptroot.firebase.emulatorHost": "localhost",
  "promptroot.firebase.emulatorAuthPort": 9099,
  "promptroot.firebase.emulatorFirestorePort": 8080
}
```

Start emulators:
```bash
cd .. # Back to root project directory
docker-compose up
# OR
firebase emulators:start
```

---

## Unit Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test constants.test.ts

# Run tests matching pattern
npm test -- --grep "Session"

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
# View HTML report: coverage/index.html
```

### Test Structure

```
src/
├── asset-creator.test.ts         # 2 tests - Basic module structure
├── constants.test.ts             # 12 tests - Command/view ID validation
├── models.test.ts                # 10 tests - Type guards, collection paths
├── jules-client.test.ts          # 16 tests - API client functionality
├── session-tree-provider.test.ts # 14 tests - Session filtering/searching
├── templates.test.ts             # 30 tests - Template generation
└── queue-manager.test.ts         # 1 skipped - Pending proper mocking
```

### Current Test Coverage

| Module | Coverage | Lines | Status |
|--------|----------|-------|--------|
| `constants.ts` | 100% | 62/62 | ✅ Complete |
| `models.ts` | 100% | 47/47 | ✅ Complete |
| `templates.ts` | 98.9% | 91/92 | ✅ Complete |
| `jules-client.ts` | 78.51% | 62/79 | ✅ Good |
| `session-tree-provider.ts` | 41.52% | 37/89 | ⚠️ Partial |
| **Overall** | **10.19%** | **299/2935** | 🎯 Targeted |

### Writing New Tests

```typescript
// Example test file structure
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Mocking VS Code API

```typescript
// Use the global mock from test-setup.ts
import vscode from 'vscode';

// Mock is automatically configured with:
// - window.showInformationMessage
// - window.showErrorMessage
// - workspace.getConfiguration
// - etc.
```

---

## Manual Testing Workflows

### Test Scenario 1: First-Time User (No Existing Data)

#### Setup
1. Open VS Code
2. Open empty folder (no `prompts/` directory)
3. Open Extensions Dev Host (F5)

#### Test Steps
1. **Initialize Workspace**
   - `Ctrl+Shift+P` → "Promptroot: Initialize Workspace"
   - ✅ Should show success message
   - ✅ Should create `prompts/` directory
   - ✅ Output channel shows initialization log

2. **Sign In**
   - `Ctrl+Shift+P` → "Promptroot: Sign In"
   - ✅ Browser opens for GitHub OAuth
   - ✅ After authorization, VS Code shows "Signed in as [Name]"
   - ✅ Status bar shows `$(account) [Your Name]`
   - ✅ Connection status shows `$(check) Online`

3. **View Profile**
   - Click status bar user item OR `Ctrl+Shift+P` → "Promptroot: View Profile"
   - ✅ Shows QuickPick with profile details
   - ✅ Displays email, UID, sign-in status

4. **Create First Prompt**
   - `Ctrl+Shift+P` → "Promptroot: Create New Prompt Asset"
   - Select template: "Basic Prompt"
   - Enter name: "Test Prompt"
   - Enter description: "My first test"
   - Select category: "general"
   - Enter author: "Tester"
   - ✅ Preview shows generated markdown
   - Click "Create"
   - ✅ File created at `prompts/test-prompt.md`
   - ✅ File opens in editor
   - ✅ Tree view refreshes and shows new file

5. **Browse Assets**
   - Look at "PROMPTROOT ASSETS" tree view
   - ✅ Shows `test-prompt.md`
   - Click file
   - ✅ Opens in editor

6. **Configure Jules API** (Optional)
   - `Ctrl+Shift+P` → "Promptroot: Configure Jules API"
   - Select "Set API Key"
   - Enter test API key
   - ✅ Shows success message
   - ✅ Key stored securely in VS Code SecretStorage

---

### Test Scenario 2: Existing User (With Data)

#### Setup
1. Open VS Code
2. Open workspace: `C:\Users\jesse\prompt-sharing`
3. Sign in with existing GitHub account

#### Test Steps

1. **Verify Assets Load**
   - ✅ "PROMPTROOT ASSETS" tree shows existing prompts
   - ✅ Folder structure preserved
   - ✅ File counts correct

2. **Add to Queue**
   - Right-click a prompt file → "Add to Queue" (if context menu exists)
   - OR: `Ctrl+Shift+P` → "Promptroot: Add to Queue"
   - Select repository (or enter custom)
   - Select branch
   - ✅ Shows confirmation
   - ✅ Item appears in "PROMPTROOT QUEUE" tree view

3. **View Queue**
   - Look at "PROMPTROOT QUEUE" tree view
   - ✅ Shows pending items with status icons
   - ✅ Shows repo and branch info
   - Click item
   - ✅ Shows details

4. **Run Queue Item**
   - Right-click queue item → "Run Queue Item"
   - ✅ Shows progress notification
   - ✅ Status updates: `pending` → `running` → `completed`
   - ✅ If error, shows error icon and details

5. **View Sessions**
   - Look at "PROMPTROOT SESSIONS" tree view
   - ✅ Shows recent sessions
   - ✅ Status icons correct (✅ success, ❌ failed, ⏳ running)
   - Click session
   - ✅ Opens session details

6. **Session Details**
   - `Ctrl+Shift+P` → "Promptroot: View Session Details"
   - Select a session
   - ✅ WebView opens with full details
   - ✅ Shows prompt, repo, branch
   - ✅ Shows PR link (if available)
   - ✅ Click "Open PR in Browser"
   - ✅ Opens GitHub PR page

7. **Repository Management**
   - Look at "PROMPTROOT REPOSITORIES" tree view
   - ✅ Shows configured repositories
   - Right-click repo → "Add to Favorites"
   - ✅ Star icon appears
   - Click repo → "Select Branch"
   - ✅ Shows branch picker with recent branches
   - Select branch
   - ✅ Confirmation shown

---

### Test Scenario 3: Error Handling & Recovery

#### Connection Errors

1. **Disconnect Network**
   - Disable Wi-Fi/Ethernet
   - Try to sign in
   - ✅ Shows network error with retry option
   - ✅ Connection status shows `$(x) Offline`
   - Re-enable network
   - ✅ Connection status auto-updates to `$(check) Online`

2. **Invalid API Key**
   - Configure Jules API with invalid key
   - Try to view Jules sources
   - ✅ Shows error: "Authentication failed"
   - ✅ Offers "Configure API" button
   - Click button
   - ✅ Opens API configuration

3. **Firestore Permission Error**
   - Sign out
   - Try to add item to queue
   - ✅ Shows auth error
   - ✅ Offers "Sign In" button

#### Error Reporting

1. **Generate Error Report**
   - `Ctrl+Shift+P` → "Promptroot: Report Error"
   - ✅ Shows options: "Copy to Clipboard", "Save to File", "View in Output"
   - Select "Copy to Clipboard"
   - ✅ Confirmation shown
   - Paste in text editor
   - ✅ Shows error summary with categories and recent errors

2. **Connection Status**
   - `Ctrl+Shift+P` → "Promptroot: Show Connection Status"
   - ✅ Shows QuickPick with:
     - Network Status (Online/Offline)
     - Firebase (Connected/Not connected)
     - GitHub API (Connected/Not connected)
     - Jules API (Configured/Not configured)

---

### Test Scenario 4: Batch Operations

1. **Add Batch to Queue**
   - `Ctrl+Shift+P` → "Promptroot: Add Batch to Queue"
   - Select folder with multiple prompts
   - Select repository
   - Select branch
   - ✅ Shows subtask modal with all prompts
   - ✅ All prompts selected by default
   - ✅ Can deselect individual prompts
   - Click "Add to Queue"
   - ✅ Creates multiple queue items
   - ✅ All appear in queue tree view

2. **Run All Pending**
   - `Ctrl+Shift+P` → "Promptroot: Run All Pending"
   - ✅ Shows progress notification
   - ✅ All pending items process sequentially
   - ✅ Status updates in real-time
   - ✅ Completed items marked with ✅
   - ✅ Failed items marked with ❌

3. **Clear Completed Items**
   - `Ctrl+Shift+P` → "Promptroot: Clear Completed Items"
   - ✅ Confirmation dialog
   - Confirm
   - ✅ Completed items removed from tree view
   - ✅ Firestore updated

4. **Clear Failed Items**
   - `Ctrl+Shift+P` → "Promptroot: Clear Failed Items"
   - ✅ Confirmation dialog
   - Confirm
   - ✅ Failed items removed from tree view

---

### Test Scenario 5: Session Tracking

1. **View Session History**
   - `Ctrl+Shift+P` → "Promptroot: View Session History"
   - ✅ Shows paginated list of sessions
   - ✅ Displays session name, status, date
   - Select session
   - ✅ Opens session details

2. **Filter Sessions**
   - `Ctrl+Shift+P` → "Promptroot: Filter Sessions"
   - Select filter: "Success"
   - ✅ Tree view shows only successful sessions
   - Select filter: "Failed"
   - ✅ Tree view shows only failed sessions
   - Select filter: "All"
   - ✅ Tree view shows all sessions

3. **Search Sessions**
   - In filter dialog, enter search term
   - ✅ Sessions filtered by prompt name, repo, or branch
   - ✅ Case-insensitive search

4. **Clear Old Sessions**
   - `Ctrl+Shift+P` → "Promptroot: Clear Old Sessions"
   - Enter days: "30"
   - ✅ Confirmation shows count of sessions to delete
   - Confirm
   - ✅ Old sessions removed

---

## Firebase Testing

### Testing with Production Firebase

#### Setup
```json
// VS Code settings.json
{
  "promptroot.firebase.useEmulator": false
}
```

#### Test Cases

1. **Authentication**
   - Sign in with real GitHub account
   - ✅ Token stored in VS Code SecretStorage
   - ✅ Firebase Auth shows user
   - Close and reopen VS Code
   - ✅ Session restored automatically

2. **Firestore Operations**
   - Add queue item
   - ✅ Check Firebase Console → Firestore → `julesQueues/{uid}/items`
   - ✅ Document created with correct fields
   - Update queue item status
   - ✅ Document updated in Firestore
   - Delete queue item
   - ✅ Document removed from Firestore

3. **Real-time Sync**
   - Open web app in browser (signed in with same account)
   - Add queue item in VS Code
   - ✅ Item appears in web app immediately
   - Add queue item in web app
   - ✅ Item appears in VS Code tree view

---

### Testing with Firebase Emulators

#### Setup

1. **Start Emulators**
```bash
# Option 1: Docker Compose
cd c:\Users\jesse\prompt-sharing
docker-compose up

# Option 2: Firebase CLI
firebase emulators:start
```

2. **Configure Extension**
```json
// VS Code settings.json
{
  "promptroot.firebase.useEmulator": true,
  "promptroot.firebase.emulatorHost": "localhost",
  "promptroot.firebase.emulatorAuthPort": 9099,
  "promptroot.firebase.emulatorFirestorePort": 8080
}
```

3. **Reload Extension**
- `Ctrl+Shift+P` → "Developer: Reload Window"

#### Test Cases

1. **Verify Emulator Connection**
   - Check Output panel
   - ✅ Shows "Firebase emulators connected"
   - Open http://localhost:4000 (Emulator UI)
   - ✅ Emulator UI loads

2. **Test Authentication**
   - Sign in with ANY email (no real GitHub needed)
   - ✅ User created in Auth emulator
   - Check Emulator UI → Authentication tab
   - ✅ User listed

3. **Test Firestore**
   - Add queue item
   - Check Emulator UI → Firestore tab
   - ✅ Document created
   - ✅ Can inspect document fields
   - Clear emulator data
   - ✅ All data removed, extension handles gracefully

4. **Test Offline Behavior**
   - Stop emulators
   - Try to add queue item
   - ✅ Shows network error
   - ✅ Retry button appears
   - Start emulators
   - Click retry
   - ✅ Operation succeeds

---

## Error Handling Testing

### Network Errors

1. **No Internet Connection**
   - Disconnect network
   - Try to sign in
   - ✅ Error: "Network connection failed"
   - ✅ Recovery suggestions shown
   - ✅ Can retry after 3 seconds

2. **Slow Connection**
   - Use network throttling tool
   - Try to load sessions
   - ✅ Shows progress indicator
   - ✅ Eventually loads or times out with error

3. **Intermittent Connection**
   - Toggle network on/off during operation
   - ✅ Retry logic kicks in
   - ✅ Eventually succeeds or fails gracefully

### Authentication Errors

1. **Expired Token**
   - Sign in, then manually revoke token in GitHub settings
   - Try to access GitHub API
   - ✅ Error: "Authentication failed"
   - ✅ Prompts to sign in again
   - ✅ "Sign In" button works

2. **Invalid Credentials**
   - Sign out
   - Cancel sign-in dialog
   - ✅ Error: "GitHub authentication cancelled"
   - ✅ Status bar shows "Sign In"

### Firestore Errors

1. **Permission Denied**
   - Sign out
   - Try to read/write Firestore
   - ✅ Error handled gracefully
   - ✅ Prompts to sign in

2. **Quota Exceeded**
   - (Hard to test without large-scale operations)
   - ✅ Should show error with retry option

### Jules API Errors

1. **Invalid API Key**
   - Set invalid Jules API key
   - Try to view Jules sources
   - ✅ Error: "Jules API authentication failed"
   - ✅ "Configure API" button appears

2. **Rate Limiting**
   - Make many rapid API calls
   - ✅ Error: "Rate limit exceeded"
   - ✅ Shows retry delay (e.g., "Retry in 60s")

### Retry Logic Testing

1. **Automatic Retry**
   - Disconnect network
   - Try operation
   - Reconnect network during retry
   - ✅ Shows "Attempt 1/3", "Attempt 2/3", etc.
   - ✅ Eventually succeeds
   - ✅ Shows success notification

2. **Exponential Backoff**
   - Monitor retry delays in Output panel
   - ✅ Delays increase: 1s → 2s → 4s → 8s

3. **Max Retries**
   - Keep network disconnected
   - ✅ After max attempts, shows final error
   - ✅ No more retries attempted

---

## Performance Testing

### Large Workspace Performance

1. **Many Prompt Files**
   - Create 1000+ `.md` files in `prompts/`
   - Open workspace
   - ✅ Tree view loads within 2 seconds
   - ✅ UI remains responsive
   - ✅ Search works quickly

2. **Deep Folder Structure**
   - Create 10+ nested folders
   - ✅ Tree view handles deep nesting
   - ✅ Expand/collapse is smooth

### Large Queue Performance

1. **Many Queue Items**
   - Add 100+ items to queue
   - ✅ Tree view loads all items
   - ✅ Filtering/searching works
   - ✅ No memory leaks

2. **Batch Operations**
   - Run 50+ queue items
   - ✅ Progress updates smoothly
   - ✅ No UI freezing
   - ✅ Memory usage stable

### Memory Usage

1. **Monitor Memory**
   - Open VS Code Task Manager (Help → Developer Tools → Performance)
   - Use extension heavily for 30 minutes
   - ✅ Memory usage under 100MB
   - ✅ No significant memory leaks

2. **Resource Cleanup**
   - Add 100 items to queue
   - Delete all items
   - ✅ Memory released
   - ✅ Event listeners removed

---

## Regression Testing Checklist

Use this checklist before each release to ensure no features broke:

### Core Features
- [ ] Extension activates on workspace open
- [ ] Commands appear in Command Palette
- [ ] Tree views load and display data
- [ ] Status bar items appear and update

### Authentication
- [ ] Sign in with GitHub works
- [ ] Sign out works
- [ ] Session persists across restarts
- [ ] Profile displays correctly
- [ ] Connection status updates

### Prompt Management
- [ ] Browse assets in tree view
- [ ] Create new prompt (all templates)
- [ ] Open prompt in editor
- [ ] File watcher updates tree view
- [ ] Refresh assets works

### Queue Management
- [ ] Add single item to queue
- [ ] Add batch to queue
- [ ] View queue items
- [ ] Run queue item
- [ ] Pause/resume queue item
- [ ] Delete queue item
- [ ] Clear completed/failed
- [ ] Queue syncs with Firestore

### Session Tracking
- [ ] View sessions in tree view
- [ ] View session details
- [ ] Open PR in browser
- [ ] Filter sessions by status
- [ ] Search sessions
- [ ] Clear old sessions

### Repository Management
- [ ] List repositories
- [ ] Add/remove favorites
- [ ] Select branch
- [ ] Set default branch
- [ ] Repository tree updates

### Error Handling
- [ ] Network errors show clear messages
- [ ] Auth errors prompt sign-in
- [ ] Retry logic works
- [ ] Error reports generate
- [ ] Connection status accurate

### Jules API
- [ ] Configure API key
- [ ] View Jules sources
- [ ] View Jules sessions
- [ ] API errors handled

### UI/UX
- [ ] Icons display correctly
- [ ] Tooltips show helpful info
- [ ] Progress indicators work
- [ ] Notifications not intrusive
- [ ] WebViews render properly

---

## Troubleshooting

### Common Issues

#### Extension Doesn't Activate
**Symptoms:** No tree views, commands missing
**Solutions:**
1. Check Output panel for errors
2. Verify activation events in `package.json`
3. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
4. Check if workspace contains `prompts/` folder

#### Sign In Fails
**Symptoms:** Browser doesn't open, or auth fails
**Solutions:**
1. Check internet connection
2. Verify GitHub account is active
3. Clear VS Code secrets: Delete from `~/.config/Code/User/globalStorage`
4. Try signing in with different browser
5. Check Output panel for detailed error

#### Tree View Empty
**Symptoms:** Tree views show "No items" but data exists
**Solutions:**
1. Click refresh button
2. Check Firestore data in Firebase Console
3. Verify authentication (signed in?)
4. Check Output panel for Firestore errors
5. Clear cache and reload

#### Tests Fail
**Symptoms:** `npm test` fails
**Solutions:**
1. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
2. Clear Vitest cache: `npx vitest --clearCache`
3. Check for TypeScript errors: `npm run compile`
4. Verify all dependencies installed: `npm ci`

#### Emulator Connection Issues
**Symptoms:** Can't connect to Firebase emulators
**Solutions:**
1. Verify emulators are running: http://localhost:4000
2. Check ports in settings match emulator config
3. Restart emulators
4. Check firewall settings
5. Try different emulator host (127.0.0.1 instead of localhost)

#### Memory Leaks
**Symptoms:** Extension consumes increasing memory
**Solutions:**
1. Check for unclosed event listeners
2. Verify disposables are registered in `context.subscriptions`
3. Profile with VS Code Developer Tools
4. Check Output panel for repeated errors

### Debug Mode

Enable verbose logging:
```typescript
// In extension.ts or firebase-config.ts
const DEBUG = true;
if (DEBUG) {
  outputChannel.appendLine(`[DEBUG] ${message}`);
}
```

View logs:
- **Output Panel:** View → Output → Select "Promptroot"
- **Developer Tools:** Help → Toggle Developer Tools → Console
- **Extension Host Log:** Help → Developer → Show Extension Host Log

### Reporting Issues

When reporting bugs, include:
1. **VS Code version:** `code --version`
2. **Extension version:** Check package.json
3. **OS:** Windows/Mac/Linux version
4. **Error message:** Full text from Output panel
5. **Steps to reproduce:** Detailed steps
6. **Expected vs actual behavior**
7. **Screenshots/videos:** If applicable

---

## Additional Resources

### Documentation
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vitest Documentation](https://vitest.dev/)

### Project Files
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Feature completion status
- [ROADMAP_PART_2.md](./ROADMAP_PART_2.md) - Development roadmap
- [PHASE_X_VERIFICATION.md](./PHASE_7_VERIFICATION.md) - Phase-specific testing guides

### Related Testing
- [Web App E2E Tests](../e2e-tests/) - Browser-based tests for web app
- [Web App Unit Tests](../src/unit-tests/) - Web app unit tests

---

**Last Updated:** February 10, 2026  
**Next Review:** Before Phase 11 completion  
**Maintainer:** Development Team
