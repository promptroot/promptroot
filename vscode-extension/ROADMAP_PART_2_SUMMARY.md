# Roadmap Part 2 - Quick Reference

**Goal:** Bring VS Code extension to full feature parity with web app

## Phase Overview

| Phase | Name | Duration Est. | Key Deliverables |
|-------|------|---------------|------------------|
| 7 | Firebase Integration & Authentication | 1-2 weeks | Firebase SDK, GitHub OAuth, User profiles |
| 8 | Jules Queue Management | 2-3 weeks | Queue CRUD, tree view, real-time sync |
| 9 | Queue Scheduling & Automation | 1-2 weeks | Schedule picker, timezone support, Cloud Functions |
| 10 | Session Tracking & Analytics | 1-2 weeks | Session history, analytics dashboard, charts |
| 11 | Advanced GitHub Integration | 1-2 weeks | Repo/branch management, PR tracking, gists |
| 12 | Production Readiness | 2-3 weeks | Testing, docs, performance, marketplace |

**Total Estimated Time:** 8-14 weeks

## Phase 7: Firebase Integration & Authentication

**What You'll Build:**
- Firebase Auth with GitHub OAuth
- Firestore connection and service layer
- User profile management
- Secure token storage

**New Commands:**
- `Promptroot: Sign In`
- `Promptroot: Sign Out`
- `Promptroot: View Profile`

**Key Files:**
- `src/auth-manager.ts`
- `src/firebase-config.ts`
- `src/firestore-service.ts`

**Test Plan:**
- Sign in/out successfully
- Profile loads from Firestore
- Auth persists across restarts

## Phase 8: Jules Queue Management

**What You'll Build:**
- "JULES QUEUE" tree view with real-time updates
- Add prompts to queue (single and batch)
- Queue item CRUD operations
- Execute queue items via Jules API
- Batch subtask management

**New Commands:**
- `Promptroot: Send to Jules Queue`
- `Promptroot: Run Queue Item`
- `Promptroot: Edit Queue Item`
- `Promptroot: Delete Queue Item`
- `Promptroot: View Subtasks`
- `Promptroot: Run All Pending`

**Key Files:**
- `src/queue-tree-provider.ts`
- `src/queue-manager.ts`
- `src/webviews/batch-subtasks.html`

**Test Plan:**
- Add single prompt to queue
- Add batch (folder) to queue
- Run queue item successfully
- Edit and delete items
- Handle execution failures

## Phase 9: Queue Scheduling & Automation

**What You'll Build:**
- Schedule picker UI (date/time/timezone)
- Timezone management and storage
- Scheduled item visualization
- Cloud Functions integration for auto-activation

**New Commands:**
- `Promptroot: Schedule Queue Items`
- `Promptroot: Unschedule Items`
- `Promptroot: Set Timezone`
- `Promptroot: View Schedule`

**Key Files:**
- `src/scheduler.ts`
- `src/webviews/queue-scheduler.html`

**Test Plan:**
- Schedule item for future
- Verify activation at scheduled time
- Change timezone
- Unschedule items

## Phase 10: Session Tracking & Analytics

**What You'll Build:**
- "JULES SESSIONS" tree view
- Session details WebView
- Analytics dashboard with charts
- Session filtering and search

**New Commands:**
- `Promptroot: View Session Details`
- `Promptroot: Open Analytics Dashboard`
- `Promptroot: View Session History`
- `Promptroot: Export Analytics`

**Key Files:**
- `src/session-tree-provider.ts`
- `src/session-tracker.ts`
- `src/analytics-calculator.ts`
- `src/webviews/analytics-dashboard.html`

**Test Plan:**
- Run item and see session appear
- View session details
- Check analytics dashboard
- Export analytics data

## Phase 11: Advanced GitHub Integration

**What You'll Build:**
- Enhanced repo/branch selection
- PR tracking tree view
- Gist integration
- Default repo/branch preferences

**New Commands:**
- `Promptroot: Configure Repositories`
- `Promptroot: Set Default Repository`
- `Promptroot: View Pull Requests`
- `Promptroot: Create Gist from Prompt`

**Key Files:**
- `src/github-client.ts`
- `src/pr-tree-provider.ts`

**Test Plan:**
- Select from 100+ branches
- View Jules-created PRs
- Create and reference gist
- Verify preferences persist

## Phase 12: Production Readiness & Distribution

**What You'll Build:**
- Comprehensive error handling
- Performance optimizations
- Complete test suite (90%+ coverage)
- Full documentation
- Marketplace listing

**New Commands:**
- `Promptroot: Report Issue`
- `Promptroot: Reset Settings`
- `Promptroot: View Logs`

**Key Files:**
- `README.md` (updated)
- `CHANGELOG.md`
- Test files (*.test.ts)
- `.vscodeignore`
- Marketplace assets

**Test Plan:**
- All E2E tests passing
- Performance benchmarks met
- Install from .vsix on clean system
- Complete user workflow end-to-end

## Success Criteria (All Phases Complete)

### Functionality Checklist
- [ ] Authenticate with GitHub
- [ ] Add prompts to queue
- [ ] Run queue items
- [ ] Schedule items for later
- [ ] View session history
- [ ] Check analytics
- [ ] All operations work offline (with cached data)

### Quality Metrics
- [ ] 90%+ test coverage
- [ ] Zero critical bugs
- [ ] Performance: Queue loads <1s, commands respond <200ms
- [ ] Memory usage <100MB for typical workspace
- [ ] All documentation complete

### User Experience
- [ ] Complete workflows achievable without leaving VS Code
- [ ] Clear error messages with recovery steps
- [ ] No blocking UI operations
- [ ] Intuitive command naming and organization

### Release Readiness
- [ ] Extension packaged as .vsix
- [ ] Marketplace listing approved
- [ ] Privacy policy and terms published
- [ ] Support channels established

## Quick Start After Part 2 Completion

### Installation
```bash
# From VS Code
1. Open Extensions (Ctrl+Shift+X)
2. Search "Promptroot"
3. Click Install
```

### First-Time Setup
```bash
1. Open Command Palette (Ctrl+Shift+P)
2. Run "Promptroot: Sign In"
3. Authenticate with GitHub
4. Run "Promptroot: Configure Jules API Key"
5. Open workspace with prompts/ folder
```

### Basic Workflow
```bash
1. Browse prompts in "PROMPTROOT ASSETS" tree view
2. Right-click prompt → "Send to Jules Queue"
3. Select repository and branch
4. Go to "JULES QUEUE" tree view
5. Right-click item → "Run Queue Item"
6. Wait for execution
7. Check "JULES SESSIONS" for results
8. Click session to view PR link
```

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           VS Code Extension Host                │
├─────────────────────────────────────────────────┤
│  Tree Views:                                    │
│  - Promptroot Assets (local files)              │
│  - Jules Queue (synced with Firestore)          │
│  - Jules Sessions (synced with Firestore)       │
│  - Pull Requests (from GitHub API)              │
├─────────────────────────────────────────────────┤
│  Services:                                      │
│  - Auth Manager (GitHub OAuth)                  │
│  - Firestore Service (queue, profile, sessions)│
│  - Jules Client (API calls)                     │
│  - GitHub Client (repos, branches, PRs)         │
│  - Queue Manager (CRUD operations)              │
│  - Session Tracker (sync and history)           │
├─────────────────────────────────────────────────┤
│  WebViews (HTML/CSS/JS):                        │
│  - Schedule Picker                              │
│  - Analytics Dashboard (Chart.js)               │
│  - Session Details                              │
│  - Batch Subtasks Manager                       │
└─────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ Firebase  │  │  Jules    │  │  GitHub   │
    │ Auth &    │  │  API      │  │  API      │
    │ Firestore │  │           │  │           │
    └───────────┘  └───────────┘  └───────────┘
```

## Data Flow Examples

### Adding Item to Queue
```
User clicks "Send to Queue"
  → Prompt content read from file
  → User selects repo/branch (GitHub API)
  → Queue item created in Firestore
  → Tree view auto-updates (real-time listener)
  → Confirmation shown
```

### Running Queue Item
```
User clicks "Run Queue Item"
  → Status changes to "running" in Firestore
  → Tree view updates immediately
  → Jules API createSession called
  → Session ID stored in queue item
  → Progress notifications shown
  → On completion: status → "completed"
  → Session appears in Sessions tree view
```

### Viewing Analytics
```
User opens Analytics Dashboard
  → All sessions fetched from Firestore
  → Metrics calculated (success rate, etc.)
  → Charts rendered in WebView
  → Time period selector filters data
  → Export button generates CSV/JSON
```

## Common Tasks Reference

### For Developers

**Adding a New Command:**
1. Add command to `package.json` contributes.commands
2. Register handler in `extension.ts`
3. Implement logic in appropriate service module
4. Add unit tests
5. Update README

**Adding a New Tree View:**
1. Create `*-tree-provider.ts` implementing `TreeDataProvider`
2. Register view in `package.json` contributes.views
3. Implement `getTreeItem()` and `getChildren()`
4. Add refresh command
5. Add context menu items

**Adding a New WebView:**
1. Create HTML file in `src/webviews/`
2. Create provider class extending WebView API
3. Implement message passing (extension ↔ webview)
4. Add CSP headers
5. Bundle resources properly

### For Testers

**Testing Authentication:**
```bash
1. Sign out completely
2. Clear all stored secrets
3. Run "Sign In"
4. Verify GitHub OAuth flow
5. Check status bar shows username
6. Restart VS Code
7. Verify still signed in
```

**Testing Queue Operations:**
```bash
1. Add item to queue
2. Verify appears in tree
3. Edit item (change branch)
4. Run item
5. Watch status change (running → completed)
6. Check session created
7. Verify PR link works
```

**Testing Offline Mode:**
```bash
1. Load extension with internet
2. Browse queue items (cached)
3. Disconnect network
4. Verify cached items still visible
5. Attempt to add item (should queue for sync)
6. Reconnect network
7. Verify sync completes
```

## Troubleshooting Common Issues

### Authentication Fails
- Check GitHub OAuth app credentials
- Verify redirect URI configuration
- Clear VS Code secrets: `Developer: Reload Window`

### Firestore Connection Fails
- Verify Firebase config in settings
- Check network connectivity
- Verify Firestore security rules allow user access
- Try emulator mode for testing

### Jules API Errors
- Verify API key configured
- Check key encryption/decryption
- Verify key has correct permissions
- Check rate limits

### Queue Items Don't Update
- Check Firestore listener status
- Verify user has read permissions
- Check browser console for errors
- Refresh tree view manually

## Tips for Phase Development

### Phase 7 (Firebase)
- Start with emulators for testing
- Use Firebase Admin SDK for server operations
- Test auth token expiration scenarios
- Implement connection retry logic early

### Phase 8 (Queue)
- Design data model carefully (hard to change later)
- Implement real-time listeners efficiently
- Test with 100+ queue items
- Handle concurrent queue operations

### Phase 9 (Scheduling)
- Always store timestamps in UTC
- Test timezone edge cases (DST changes)
- Consider future/past date validation
- Test Cloud Function locally first

### Phase 10 (Sessions)
- Implement pagination early (sessions grow fast)
- Cache session data aggressively
- Test chart rendering performance
- Consider data retention policies

### Phase 11 (GitHub)
- Respect GitHub API rate limits
- Cache repo/branch data
- Handle large repos (1000+ branches)
- Test with various GitHub permissions

### Phase 12 (Production)
- Don't skip testing phase
- Get external users to test
- Profile performance with real data
- Document everything before publishing

---

**Ready to build?** Reference the full [ROADMAP_PART_2.md](./ROADMAP_PART_2.md) for detailed task breakdowns, acceptance criteria, and implementation notes for each phase.
