# Promptroot VS Code Extension

A VS Code extension that streamlines Promptroot workflows directly inside the editor with full Firebase integration, queue management, and session tracking.

## Features

### Authentication & User Management
- **GitHub OAuth** - Sign in with your GitHub account via Firebase Auth
- **User Profile** - View profile info, sign-in status, account settings
- **Status Bar Integration** - User info and connection status at a glance
- **Secure Storage** - API keys and tokens stored securely in VS Code SecretStorage

### Asset Management
- **Tree View** - Browse all Promptroot assets in Explorer sidebar
- **File System Integration** - Real-time sync with `prompts/` directory
- **Create Prompts** - Guided workflow with 3 template types (Basic, Task, Tutorial)
- **Metadata Collection** - Name, description, category, author with validation
- **Preview & Confirm** - See generated content before file creation

### Queue Management
- **Queue Tree View** - Visual queue with status icons and real-time updates
- **Add to Queue** - Single prompts or batch operations with repo/branch selection
- **Queue Operations** - Run, pause, resume, delete items with progress tracking
- **Batch Processing** - Run multiple items, clear completed/failed operations
- **Subtask Management** - WebView for complex batch operations

### Session Tracking
- **Session History** - Tree view of Jules sessions with PR links and status
- **Session Details** - WebView showing full session info, logs, and PR details
- **Real-time Sync** - Sessions update automatically as Jules processes them
- **Filter & Search** - Find sessions by status, name, repo, or date range
- **PR Integration** - Open GitHub PRs directly from session results

### Repository Management
- **Repository Tree** - Browse configured repositories with favorites
- **Branch Selection** - Smart branch picker with recent branches and search
- **Default Branches** - Set per-repo default branches for quick selection
- **GitHub Integration** - Full GitHub API integration for repo/branch data

### Error Handling & Recovery
- **Smart Error Detection** - 9 error categories with specific recovery suggestions
- **Retry Logic** - Exponential backoff for network and transient errors
- **Connection Monitoring** - Real-time network and service status indicators
- **Error Reporting** - Generate diagnostic reports for troubleshooting

### Jules API Integration
- **Secure Configuration** - API key management with encrypted storage
- **Sources & Sessions** - Browse connected repositories and session history
- **Progress Tracking** - Real-time updates during Jules API operations

## Quick Start

1. **Install Extension** (Development)
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   # Press F5 in VS Code to launch Extension Development Host
   ```

2. **Open Workspace**
   - Open any folder in VS Code
   - Look for "PROMPTROOT ASSETS" in Explorer sidebar

3. **Sign In**
   - `Ctrl+Shift+P` → "Promptroot: Sign In"
   - Authorize with GitHub (same account as web app)
   - Status bar shows: `$(account) Your Name`

4. **Create Your First Prompt**
   - `Ctrl+Shift+P` → "Promptroot: Create New Prompt Asset"
   - Choose template → Fill metadata → Preview → Create
   - File opens automatically in editor

5. **Add to Queue**
   - `Ctrl+Shift+P` → "Promptroot: Add to Queue"
   - Select repository and branch
   - Item appears in "PROMPTROOT QUEUE" tree view

6. **Run Queue**
   - Right-click queue item → "Run Queue Item"
   - OR: `Ctrl+Shift+P` → "Promptroot: Run All Pending"
   - Watch progress in "PROMPTROOT SESSIONS" tree view

## Core Commands

### Authentication
- `Promptroot: Sign In` - GitHub OAuth authentication
- `Promptroot: Sign Out` - Sign out and clear tokens
- `Promptroot: View Profile` - Display user profile information

### Asset Management
- `Promptroot: Initialize Workspace` - Create prompts directory
- `Promptroot: Browse Assets` - Focus on assets tree view
- `Promptroot: Refresh Assets` - Reload assets from file system
- `Promptroot: Create New Prompt Asset` - Guided prompt creation

### Queue Operations
- `Promptroot: Add to Queue` - Add single prompt to processing queue
- `Promptroot: Add Batch to Queue` - Add multiple prompts with selection
- `Promptroot: Run Queue Item` - Execute specific queue item
- `Promptroot: Run All Pending` - Process all pending items
- `Promptroot: Clear Completed Items` - Remove completed items
- `Promptroot: Clear Failed Items` - Remove failed items

### Session Management
- `Promptroot: View Session Details` - Open session in WebView
- `Promptroot: View Session History` - Browse paginated session list
- `Promptroot: Filter Sessions` - Filter by status (All/Success/Failed/Running)
- `Promptroot: Clear Old Sessions` - Remove sessions older than X days
- `Promptroot: Open PR in Browser` - Open GitHub PR from session

### Repository Management
- `Promptroot: Refresh Repositories` - Reload repository list
- `Promptroot: Configure Repositories` - Manage repo settings
- `Promptroot: Select Branch` - Choose branch for repository
- `Promptroot: Add Favorite Repository` - Star frequently used repos

### Tools & Diagnostics
- `Promptroot: Configure Jules API` - Set up Jules API key
- `Promptroot: View Jules Sources` - List connected repositories
- `Promptroot: Show Connection Status` - Display service status
- `Promptroot: Report Error` - Generate diagnostic report

## Tree Views

The extension adds four tree views to Explorer sidebar:

1. **PROMPTROOT ASSETS** - Browse local `.md` files in `prompts/` directory
2. **PROMPTROOT QUEUE** - Manage processing queue with status indicators
3. **PROMPTROOT SESSIONS** - Track Jules session history with PR links
4. **PROMPTROOT REPOSITORIES** - Browse configured repos with favorites

## Data Synchronization

The extension uses the same Firebase backend as the web app:
- **Same Account** - Sign in with your GitHub account, see same data
- **Real-time Sync** - Changes in extension appear in web app immediately
- **Offline Support** - Local prompt browsing works without connection
- **Secure Storage** - All data encrypted and user-isolated

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `promptroot.assetsPath` | string | "prompts" | Path to prompts directory |
| `promptroot.autoDetect` | boolean | true | Auto-detect Promptroot workspaces |
| `promptroot.firebase.useEmulator` | boolean | false | Use Firebase emulators for development |
| `promptroot.firebase.emulatorHost` | string | "localhost" | Firebase emulator host |

## Development

### Scripts
```bash
npm run compile     # Compile TypeScript
npm run watch       # Watch mode compilation  
npm run lint        # Run ESLint
npm test            # Run unit tests (84 passing)
npm run test:watch  # Test watch mode
npm run package     # Create .vsix package
```

### Testing
- **Unit Tests:** 84 passing tests with targeted coverage on critical modules
- **Manual Testing:** Press F5 to launch Extension Development Host
- **See [TESTING.md](./TESTING.md)** for complete testing instructions

### Architecture
- **TypeScript** - Strict typing with explicit types
- **Modular Design** - Small, focused modules with single responsibility
- **VS Code API** - Follows official extension guidelines
- **Firebase SDK** - Auth, Firestore with retry logic and caching
- **Error Handling** - Comprehensive categorization with recovery suggestions

## Requirements

- **VS Code:** 1.85.0 or higher
- **Node.js:** 20.x or higher
- **Internet Connection:** Required for authentication and sync features
- **GitHub Account:** For authentication (same account as web app)

## Troubleshooting

### Extension Not Loading
- Check Output panel (View → Output → "Promptroot") for errors
- Try reloading window: `Ctrl+Shift+P` → "Developer: Reload Window"
- Verify workspace contains `prompts/` folder or run "Initialize Workspace"

### Authentication Issues
- Ensure GitHub account is active and accessible
- Clear stored tokens and sign in again
- Check internet connection and firewall settings
- Try signing out and back in

### Queue/Session Issues
- Verify you're signed in (check status bar)
- Check Firebase connection status via "Show Connection Status"
- Try refreshing tree views manually
- Check Output panel for detailed error messages

### Performance Issues
- Large workspaces (1000+ files) may load slowly on first open
- Use "Refresh Assets" sparingly with many files
- Consider excluding large directories from VS Code file watching

See [TESTING.md](./TESTING.md) for comprehensive testing and troubleshooting guide.

## Contributing

This extension is part of the larger Promptroot project. For development:

1. Fork the repository
2. Create feature branch
3. Follow TypeScript and ESLint rules
4. Add unit tests for new features
5. Test manually with Extension Development Host
6. Submit pull request with clear description

## License

MIT License - see parent project for details.

---

**Extension Status:** Production Ready (Phase 9 Complete)  
**Last Updated:** February 10, 2026  
**Total Commands:** 30+ commands across 4 tree views  
**Test Coverage:** 84 passing unit tests

Follow the phased roadmap in docs/prompt.md. Each phase has specific acceptance criteria and completion conditions.

## Development Roadmap

### Part 1: Foundation ✅ COMPLETE (Phases 1-6)
- ✅ Phase 1: Foundation & Scaffolding
- ✅ Phase 2: Core UI Surface
- ✅ Phase 3: Promptroot Integration (Read-Only)
- ✅ Phase 4: Jules API Integration (Read-Only)
- ✅ Phase 5: Authoring & Actions (Write Operations)
- ✅ Phase 6: Quality & Release Readiness

**Status:** Production ready for local prompt management and read-only Jules API integration

### Part 2: Full Feature Parity 📋 PLANNED (Phases 7-12)

Bring the extension to complete feature parity with the main Promptroot web application.

- **Phase 7:** Firebase Integration & Authentication
  - GitHub OAuth authentication
  - Firestore database connection
  - User profile management
  - Secure credential storage

- **Phase 8:** Jules Queue Management
  - Add prompts to Jules queue (single and batch)
  - Queue item CRUD operations
  - Real-time queue synchronization
  - Execute queue items via Jules API

- **Phase 9:** Queue Scheduling & Automation
  - Schedule queue items for future execution
  - Timezone management
  - Cloud Functions integration for auto-activation
  - Schedule visualization

- **Phase 10:** Session Tracking & Analytics
  - Track Jules session execution
  - Analytics dashboard with charts
  - Session history and filtering
  - PR link tracking

- **Phase 11:** Advanced GitHub Integration
  - Repository and branch management
  - PR tracking and notifications
  - Gist integration
  - Default repo/branch preferences

- **Phase 12:** Production Readiness & Distribution
  - Comprehensive testing (90%+ coverage)
  - Performance optimization
  - Complete documentation
  - VS Code Marketplace publishing

**Documentation:**
- [📋 ROADMAP_PART_2.md](./ROADMAP_PART_2.md) - Detailed phase breakdown with tasks and acceptance criteria
- [📊 ROADMAP_PART_2_SUMMARY.md](./ROADMAP_PART_2_SUMMARY.md) - Quick reference and architecture overview
- [✅ PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md) - Task-by-task progress checklist

**Estimated Timeline:** 8-14 weeks for full feature parity

## License

AGPL-3.0-only
