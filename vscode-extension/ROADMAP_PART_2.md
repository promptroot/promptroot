# VS Code Extension - Roadmap Part 2: Full Feature Parity

**Created:** February 8, 2026  
**Status:** Planning Phase  
**Goal:** Achieve complete feature parity with the main PromptSync web application

## Prerequisites

Before starting Part 2, ensure all Phase 1-6 work is complete:
- ✅ Phase 1 - Foundation & Scaffolding
- ✅ Phase 2 - Core UI Surface
- ✅ Phase 3 - Promptroot Integration (Read-Only)
- ✅ Phase 4 - Jules API Integration (Read-Only)
- ✅ Phase 5 - Authoring & Actions (Write Operations)
- ✅ Phase 6 - Quality & Release Readiness

## Overview

The extension currently provides:
- Local prompt asset browsing and creation
- Read-only Jules API integration (view sources and sessions)
- Basic prompt templates

Part 2 will add:
- **Firebase/Firestore integration** for cloud persistence
- **GitHub OAuth authentication** via Firebase
- **Jules Queue management** (add, edit, schedule, run)
- **Session tracking and analytics**
- **Advanced GitHub integration** (repo/branch selection, PR tracking)
- **Cloud Functions integration** for automation

---

## Phase 7 — Firebase Integration & Authentication

**Goal:** Connect extension to Firebase backend with user authentication

### Tasks

#### 7.1 Firebase SDK Integration
- [ ] Add Firebase SDK dependencies (@google-cloud/firestore, firebase-admin)
- [ ] Create `firebase-config.ts` with connection settings
- [ ] Implement environment-based configuration (dev emulators vs production)
- [ ] Add VS Code settings for Firebase project ID and emulator ports

#### 7.2 Authentication Implementation
- [ ] Implement GitHub OAuth flow using Firebase Auth
- [ ] Store auth tokens securely using VS Code SecretStorage
- [ ] Create `auth-manager.ts` module for authentication state
- [ ] Add status bar item showing current user
- [ ] Add "Sign In" and "Sign Out" commands
- [ ] Handle token refresh and expiration

#### 7.3 Firestore Service Layer
- [ ] Create `firestore-service.ts` for database operations
- [ ] Implement connection pooling and retry logic
- [ ] Add offline support and caching
- [ ] Create TypeScript interfaces for data models:
  - `JulesQueueItem` (single and batch)
  - `UserProfile`
  - `JulesSession`
  - `ApiKey` (encrypted storage)

#### 7.4 User Profile Management
- [ ] Load user profile from Firestore on sign-in
- [ ] Store user preferences (timezone, default repo/branch)
- [ ] Add "View Profile" command
- [ ] Display Jules API key status (configured/not configured)

### Acceptance Criteria
- [ ] Extension authenticates users via GitHub OAuth
- [ ] Current user displayed in status bar
- [ ] Connection to Firestore verified (read/write test)
- [ ] User profile loads correctly after sign-in
- [ ] Auth state persists across VS Code restarts
- [ ] Clear error messages for auth failures

### Completion Conditions
- [ ] Successfully sign in and sign out
- [ ] User data readable from Firestore
- [ ] Auth state visible in UI
- [ ] Verified with both production and emulator environments

### Implementation Notes
- Use VS Code's built-in authentication providers where possible
- Store Firebase config in workspace settings (`.vscode/settings.json`)
- Support both production Firebase and local emulators
- Implement comprehensive error handling for network issues

---

## Phase 8 — Jules Queue Management

**Goal:** Implement full queue CRUD operations with synchronized UI

### Tasks

#### 8.1 Queue Tree View
- [ ] Create new "JULES QUEUE" tree view in Explorer sidebar
- [ ] Implement `JulesQueueTreeProvider` class
- [ ] Display queue items with icons based on status:
  - 📝 pending
  - ▶️ running
  - ✅ completed
  - ❌ failed
  - ⏸️ paused
  - 📅 scheduled
- [ ] Show item metadata (prompt name, repo, branch, status)
- [ ] Implement real-time sync with Firestore (listen to updates)
- [ ] Add visual indicators for errors and scheduled times

#### 8.2 Add to Queue Commands
- [ ] Add "Send to Jules Queue" command for current file
- [ ] Add context menu item in file explorer
- [ ] Implement repo/branch selection UI (QuickPick)
- [ ] Support single prompt submission
- [ ] Support batch prompt submission (folder selection)
- [ ] Add validation (check if file is a valid prompt)
- [ ] Show confirmation with queue item preview

#### 8.3 Queue Item Management
- [ ] Add "Edit Queue Item" command
- [ ] Add "Delete Queue Item" command
- [ ] Add "Pause/Resume Queue Item" command
- [ ] Add "View Queue Item Details" command (opens WebView)
- [ ] Add "Duplicate Queue Item" command
- [ ] Support multi-select operations
- [ ] Add "Clear Completed Items" command
- [ ] Add "Clear Failed Items" command

#### 8.4 Queue Execution
- [ ] Add "Run Queue Item" command
- [ ] Integrate with Jules API's `createJulesSession()` function
- [ ] Show progress notifications during execution
- [ ] Update queue item status in real-time
- [ ] Handle execution errors and update error state
- [ ] Add "Run Next Pending" command
- [ ] Add "Run All Pending" command with rate limiting

#### 8.5 Batch Operations
- [ ] Implement subtask manager for batch items
- [ ] Add "View Subtasks" command (WebView with table)
- [ ] Support selective subtask execution
- [ ] Handle individual subtask failures
- [ ] Add "Retry Failed Subtasks" command

### Acceptance Criteria
- [ ] Queue view displays all user's queue items
- [ ] Items update in real-time as status changes
- [ ] Can add single prompts to queue from any markdown file
- [ ] Can add batches of prompts (entire folder)
- [ ] Can edit, delete, pause, and resume items
- [ ] Can run items and see execution progress
- [ ] Batch items show subtask progress
- [ ] Clear error messages for all failure scenarios

### Completion Conditions
- [ ] Add item to queue (single and batch)
- [ ] Edit and delete items
- [ ] Run queue item successfully
- [ ] Handle execution failure gracefully
- [ ] Verify real-time sync works
- [ ] Test all multi-select operations

### Implementation Notes
- Use Firestore real-time listeners for queue sync
- Implement debouncing for UI updates
- Use VS Code Progress API for long-running operations
- Consider using WebView for complex UIs (batch subtasks)
- Cache queue items locally for offline viewing

---

## Phase 9 — Queue Scheduling & Automation

**Goal:** Enable scheduled execution of queue items with timezone support

### Tasks

#### 9.1 Scheduling UI
- [ ] Add "Schedule Queue Items" command
- [ ] Create WebView for schedule picker (date/time/timezone)
- [ ] Implement timezone selection UI (QuickPick with common zones)
- [ ] Load user's saved timezone from Firestore
- [ ] Support multi-select scheduling
- [ ] Add "Unschedule" command
- [ ] Show schedule info in queue tree view (date/time badge)

#### 9.2 Scheduled Item Visualization
- [ ] Add clock icon (⏰) to scheduled items
- [ ] Show formatted schedule time in tree item description
- [ ] Add color coding for scheduled items (blue border)
- [ ] Sort scheduled items by schedule time
- [ ] Add "View Schedule" command (calendar view in WebView)

#### 9.3 Cloud Functions Integration
- [ ] Document Cloud Functions setup for schedule activation
- [ ] Test with Firebase emulators
- [ ] Add settings for function URLs (dev vs production)
- [ ] Handle activation webhooks/notifications
- [ ] Add "Test Activation" command for debugging

#### 9.4 Timezone Management
- [ ] Store user's timezone preference in Firestore
- [ ] Add "Set Timezone" command
- [ ] Display all times in user's timezone
- [ ] Handle daylight saving time transitions
- [ ] Add timezone indicator in status bar

### Acceptance Criteria
- [ ] Can schedule single or multiple queue items
- [ ] Schedule picker shows times in user's timezone
- [ ] Scheduled items display schedule info clearly
- [ ] Items automatically activate at scheduled time (via Cloud Functions)
- [ ] Can unschedule items
- [ ] Timezone preference persists
- [ ] Clear indicators for overdue scheduled items

### Completion Conditions
- [ ] Schedule an item for future execution
- [ ] Verify Cloud Function activates item at scheduled time
- [ ] Change timezone and verify display updates
- [ ] Unschedule item successfully
- [ ] Test with multiple scheduled items

### Implementation Notes
- Use `luxon` or `date-fns-tz` for timezone handling
- Store all timestamps in UTC in Firestore
- Display times in user's local timezone
- Implement WebView for advanced scheduling UI
- Add calendar/timeline visualization for scheduled items

---

## Phase 10 — Session Tracking & Analytics

**Goal:** Track Jules sessions and provide analytics dashboard

### Tasks

#### 10.1 Session Tracking Integration
- [ ] Listen to `juleSessions/{userId}/sessions` collection
- [ ] Create "JULES SESSIONS" tree view
- [ ] Display recent sessions with status icons
- [ ] Show PR links for successful sessions
- [ ] Add "View Session Details" command (WebView)
- [ ] Add "Open PR in Browser" command
- [ ] Sync session status from Jules API periodically

#### 10.2 Session Details View
- [ ] Create WebView for session details
- [ ] Display prompt used, repo/branch
- [ ] Show plan steps and execution log
- [ ] Display PR info (title, description, URL)
- [ ] Show failure reason if failed
- [ ] Add "Retry Session" command (creates new queue item)
- [ ] Add "Copy Session URL" command

#### 10.3 Analytics Dashboard
- [ ] Create WebView for analytics dashboard
- [ ] Implement metrics calculations:
  - Total sessions
  - Success rate
  - PRs created count
  - Average completion time
  - Failure rate by prompt
- [ ] Add time period selector (7d, 30d, 90d, year, all)
- [ ] Create charts using Chart.js or similar:
  - Status distribution (pie chart)
  - Sessions over time (line chart)
  - Success rate by prompt (bar chart)
- [ ] Add "Export Analytics" command (CSV/JSON)

#### 10.4 Session History
- [ ] Add "View Session History" command
- [ ] Implement pagination for large session lists
- [ ] Add search/filter capabilities:
  - By status
  - By prompt
  - By date range
  - By repository
- [ ] Add "Clear Old Sessions" command (with confirmation)

### Acceptance Criteria
- [ ] Sessions appear in tree view after execution
- [ ] Session details display all relevant info
- [ ] PR links are clickable and open in browser
- [ ] Analytics dashboard shows accurate metrics
- [ ] Charts render correctly
- [ ] Can filter and search session history
- [ ] Analytics export works

### Completion Conditions
- [ ] Run queue item and see session appear
- [ ] View session details in WebView
- [ ] Open analytics dashboard with real data
- [ ] Export analytics successfully
- [ ] Filter session history by various criteria

### Implementation Notes
- Use real-time listeners for session updates
- Cache session data locally for offline viewing
- Implement efficient pagination (cursor-based)
- Use Chart.js in WebView for visualizations
- Consider implementing session comparison feature

---

## Phase 11 — Advanced GitHub Integration

**Goal:** Full GitHub repository and branch management

### Tasks

#### 11.1 Repository Management
- [ ] Add "Configure GitHub Repositories" command
- [ ] List all accessible repos (via GitHub API)
- [ ] Show repos connected via Jules GitHub App
- [ ] Add favorite/pin repositories
- [ ] Store repo preferences in Firestore
- [ ] Add "Refresh Repositories" command
- [ ] Show repo metadata (visibility, description, default branch)

#### 11.2 Branch Selection & Management
- [ ] Improve branch selection UI (QuickPick with search)
- [ ] Show recent branches at top
- [ ] Display branch protection status
- [ ] Add "Set Default Branch" per repo
- [ ] Cache branch lists with TTL
- [ ] Add "Create New Branch" command
- [ ] Show current branch in status bar (for queued items)

#### 11.3 PR Tracking & Management
- [ ] Add "PULL REQUESTS" tree view
- [ ] List PRs created by Jules sessions
- [ ] Show PR status (open, merged, closed)
- [ ] Add "Open PR in GitHub" command
- [ ] Add "Copy PR URL" command
- [ ] Show code review status (approved, changes requested)
- [ ] Add notifications for PR updates

#### 11.4 Gist Integration
- [ ] Support gist pointer patterns in prompts
- [ ] Add "Create Gist from Prompt" command
- [ ] Add "Update Gist" command
- [ ] Add "View Gist History" command
- [ ] Implement gist caching for offline access

### Acceptance Criteria
- [ ] Can browse and select any accessible repository
- [ ] Branch selection shows all branches with search
- [ ] Default repo/branch preferences persist
- [ ] PR tree view shows all Jules-created PRs
- [ ] Can open PRs directly in browser
- [ ] Gist pointers resolve correctly
- [ ] Repository list stays up-to-date

### Completion Conditions
- [ ] Configure default repository
- [ ] Select branch from large repo (100+ branches)
- [ ] View PRs created by extension
- [ ] Create and reference a gist
- [ ] Verify repo/branch preferences persist

### Implementation Notes
- Implement GitHub API client with rate limit handling
- Use incremental loading for large branch lists
- Cache repository metadata aggressively
- Use GitHub's GraphQL API for PR status
- Implement webhook support for PR notifications

---

## Phase 12 — Production Readiness & Distribution

**Goal:** Polish, optimize, and prepare for public distribution

### Tasks

#### 12.1 Error Handling & Recovery
- [ ] Implement comprehensive error categorization
- [ ] Add error recovery suggestions for common issues
- [ ] Create error reporting command (sends to logging service)
- [ ] Add retry logic for transient failures
- [ ] Implement offline mode with sync queue
- [ ] Add connection status indicator
- [ ] Create troubleshooting guide in docs

#### 12.2 Performance Optimization
- [ ] Implement intelligent caching strategy
- [ ] Add request deduplication
- [ ] Optimize Firestore queries (indexes, batching)
- [ ] Implement lazy loading for large lists
- [ ] Add resource cleanup (listeners, timers)
- [ ] Profile memory usage and fix leaks
- [ ] Optimize WebView loading times

#### 12.3 Settings & Configuration
- [ ] Add comprehensive extension settings:
  - Firebase project ID
  - Emulator configuration
  - Default repository/branch
  - Queue auto-run preferences
  - Notification preferences
  - Cache durations
- [ ] Create settings UI (WebView)
- [ ] Add settings validation
- [ ] Add "Reset to Defaults" command
- [ ] Document all settings in README

#### 12.4 Testing & Quality
- [ ] Increase unit test coverage to 90%+
- [ ] Add integration tests for Firebase operations
- [ ] Add E2E tests for critical flows:
  - Authentication
  - Add to queue
  - Run queue item
  - Schedule item
- [ ] Test with various network conditions
- [ ] Test with large workspaces (1000+ prompts)
- [ ] Test with multiple Firebase projects
- [ ] Load testing for concurrent operations

#### 12.5 Documentation
- [ ] Update README with complete feature list
- [ ] Create user guide with screenshots
- [ ] Create video walkthrough
- [ ] Document Firebase setup process
- [ ] Document GitHub App connection process
- [ ] Create troubleshooting FAQ
- [ ] Add inline documentation for all commands
- [ ] Create migration guide from web app

#### 12.6 Marketplace Preparation
- [ ] Create marketplace listing content
- [ ] Design extension icon and banner
- [ ] Create animated GIF demos
- [ ] Set up CI/CD for automated publishing
- [ ] Configure semantic versioning
- [ ] Set up changelog automation
- [ ] Create privacy policy
- [ ] Create terms of service

#### 12.7 Telemetry & Analytics (Optional)
- [ ] Add opt-in telemetry
- [ ] Track feature usage (anonymized)
- [ ] Track error rates
- [ ] Create analytics dashboard
- [ ] Implement feedback collection

### Acceptance Criteria
- [ ] 90%+ test coverage achieved
- [ ] All E2E tests passing
- [ ] Extension works offline (with cached data)
- [ ] All settings documented and functional
- [ ] Performance meets benchmarks:
  - Queue view loads in <1s
  - Command response in <200ms
  - Memory usage <100MB for typical workspace
- [ ] Documentation complete and clear
- [ ] Extension packaged and installable
- [ ] Ready for marketplace submission

### Completion Conditions
- [ ] All tests passing (unit, integration, E2E)
- [ ] Extension installed from .vsix on clean system
- [ ] Full workflow tested end-to-end:
  1. Install extension
  2. Sign in
  3. Configure Firebase
  4. Add prompt to queue
  5. Schedule item
  6. Run item
  7. View session results
  8. Check analytics
- [ ] Documentation reviewed by external user
- [ ] Performance benchmarks met
- [ ] Security review passed
- [ ] Marketplace listing approved

### Implementation Notes
- Use Application Insights or similar for telemetry
- Implement feature flags for gradual rollout
- Set up error monitoring (Sentry or similar)
- Use semantic-release for automated versioning
- Create comprehensive CI/CD pipeline
- Implement beta testing program

---

## Execution Guidelines

### Development Approach
1. **One Phase at a Time** - Complete each phase fully before moving to the next
2. **Test Continuously** - Test after each major change, not just at phase end
3. **Document as You Go** - Update docs immediately after implementing features
4. **Incremental Commits** - Small, focused commits with clear messages
5. **Verification Gates** - All acceptance criteria must pass before proceeding

### Phase Dependencies
- Phase 7 (Firebase) must be complete before starting Phase 8
- Phase 8 (Queue) must be complete before Phase 9 (Scheduling)
- Phase 10 (Sessions) can be developed in parallel with Phase 9
- Phase 11 (GitHub) can be developed in parallel with Phase 10
- Phase 12 (Production) must be last

### Testing Strategy
- **Unit Tests**: For all business logic (queue operations, data transformations)
- **Integration Tests**: For Firebase and Jules API interactions
- **E2E Tests**: For complete user workflows
- **Manual Testing**: For UI and UX validation
- **Performance Tests**: For large-scale operations

### Documentation Requirements
Each phase must include:
- Updated README with new features
- JSDoc/TSDoc comments for all public APIs
- User-facing documentation (commands, settings)
- Developer documentation (architecture, data models)
- Verification guide (PHASE_X_VERIFICATION.md)

---

## Success Metrics

### Functionality
- ✅ All main app features available in extension
- ✅ Feature parity verified by checklist
- ✅ No regression in existing Phase 1-6 features

### Quality
- ✅ 90%+ test coverage
- ✅ Zero critical bugs
- ✅ Performance benchmarks met
- ✅ Documentation complete

### User Experience
- ✅ All workflows achievable without leaving VS Code
- ✅ Clear error messages and recovery paths
- ✅ Responsive UI (no blocking operations)
- ✅ Intuitive command organization

### Release
- ✅ Extension published to VS Code Marketplace
- ✅ Installation and setup documented
- ✅ Support channels established
- ✅ Feedback mechanism in place

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Firebase connection issues | Implement robust retry logic, offline mode, clear error messages |
| Performance with large queues | Implement pagination, lazy loading, efficient queries |
| VS Code API limitations | Research APIs in advance, implement WebViews where needed |
| Security vulnerabilities | Use SecretStorage, never log sensitive data, security review |

### Scope Risks
| Risk | Mitigation |
|------|------------|
| Feature creep | Stick to roadmap, defer nice-to-haves to post-v1.0 |
| Timeline overruns | Time-box each phase, cut non-critical features if needed |
| Complexity explosion | Maintain modular architecture, refactor continuously |

### User Adoption Risks
| Risk | Mitigation |
|------|------------|
| Poor onboarding | Create comprehensive getting started guide and videos |
| Migration friction | Provide migration tools, maintain web app compatibility |
| Feature discoverability | Use command palette, add welcome screen, tooltips |

---

## Post-Launch Roadmap (Future Phases)

### Phase 13 — Advanced Features
- AI-powered prompt suggestions
- Template marketplace
- Collaborative queue sharing
- Workspace sync across devices
- Custom Jules source types

### Phase 14 — Enterprise Features
- Team accounts and sharing
- Usage quotas and billing
- Admin dashboard
- Audit logging
- SSO integration

### Phase 15 — Integrations
- Azure DevOps integration
- GitLab support
- Bitbucket support
- Slack/Teams notifications
- Jira/Linear integration

---

## Appendix

### Technology Stack
- **Language**: TypeScript
- **VS Code APIs**: Authentication, Tree View, WebView, Settings, Status Bar
- **Firebase**: Auth, Firestore, Cloud Functions
- **GitHub API**: REST API v3, GraphQL v4
- **Jules API**: Google's AI coding assistant API
- **Testing**: Vitest, VS Code Extension Tester
- **Build**: esbuild, vsce
- **UI**: WebView with HTML/CSS/JS (for complex UIs)

### Data Models

#### JulesQueueItem (Single)
```typescript
{
  id: string;
  type: 'single';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'scheduled';
  prompt: string;
  promptPath: string;
  sourceId: string;
  branch: string;
  scheduledAt?: Timestamp;
  scheduledTimeZone?: string;
  lastError?: {
    message: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### JulesQueueItem (Batch)
```typescript
{
  id: string;
  type: 'batch';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  subtasks: Array<{
    promptPath: string;
    status: string;
    sessionId?: string;
  }>;
  sourceId: string;
  branch: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### JulesSession
```typescript
{
  sessionId: string;
  name: string;
  promptPath: string;
  sourceId: string;
  branch: string;
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PLANNING' | 'QUEUED';
  pr?: {
    url: string;
    title: string;
    description: string;
  };
  failureReason?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  julesUrl: string;
}
```

### Firebase Collections Structure
```
users/{uid}
  - profile data
  - timezone preference
  - default repo/branch

apiKeys/{uid}
  - encrypted Jules API key

julesQueues/{uid}/items/{itemId}
  - queue items

juleSessions/{uid}/sessions/{sessionId}
  - tracked sessions
```

### Key Files to Create
- `src/auth-manager.ts`
- `src/firebase-config.ts`
- `src/firestore-service.ts`
- `src/queue-tree-provider.ts`
- `src/queue-manager.ts`
- `src/session-tree-provider.ts`
- `src/session-tracker.ts`
- `src/analytics-calculator.ts`
- `src/github-client.ts`
- `src/webviews/queue-scheduler.html`
- `src/webviews/analytics-dashboard.html`
- `src/webviews/session-details.html`
- `src/webviews/batch-subtasks.html`

---

## Verification Checklist (All Phases)

Use this checklist to verify complete feature parity with the web app:

### Authentication & User Management
- [ ] Sign in with GitHub OAuth
- [ ] Sign out
- [ ] View user profile
- [ ] Configure Jules API key
- [ ] User preferences persist

### Prompt Management
- [ ] Browse prompt library (Phase 3 ✅)
- [ ] Open prompts in editor (Phase 3 ✅)
- [ ] Create new prompts (Phase 5 ✅)
- [ ] Use templates (Phase 5 ✅)
- [ ] Validate prompt structure

### Queue Management
- [ ] View queue items
- [ ] Add single prompt to queue
- [ ] Add batch (folder) to queue
- [ ] Edit queue item (repo/branch/prompt)
- [ ] Delete queue item
- [ ] Pause/resume queue item
- [ ] Run queue item
- [ ] View queue item details
- [ ] Clear completed items
- [ ] Clear failed items

### Scheduling
- [ ] Schedule single item
- [ ] Schedule multiple items
- [ ] Unschedule items
- [ ] Set timezone preference
- [ ] View scheduled items
- [ ] Items activate at scheduled time

### Session Tracking
- [ ] View session history
- [ ] View session details
- [ ] Open PR from session
- [ ] Retry failed session
- [ ] Filter sessions by status
- [ ] Search sessions

### Analytics
- [ ] View analytics dashboard
- [ ] Change time period
- [ ] View charts (status, timeline)
- [ ] Export analytics data
- [ ] View success rate by prompt

### GitHub Integration
- [ ] List repositories
- [ ] Select repository
- [ ] List branches
- [ ] Select branch
- [ ] Set default repo/branch
- [ ] View PRs
- [ ] Open PR in browser
- [ ] Create gist

### Settings
- [ ] Configure Firebase
- [ ] Configure emulators
- [ ] Set preferences
- [ ] Reset to defaults

### Error Handling
- [ ] Network errors show clear messages
- [ ] Auth errors provide recovery steps
- [ ] Queue errors persist and display
- [ ] Offline mode works
- [ ] Rate limit errors handled

---

**Ready to Begin?** Start with Phase 7 and work through methodically. Each phase builds upon the previous, creating a robust, feature-complete VS Code extension that provides the full PromptSync experience directly in your editor.
