# Promptroot VS Code Extension Architecture

**Version:** 1.0  
**Last Updated:** February 5, 2026

## Overview

This document describes the architecture of the Promptroot VS Code extension, designed to streamline Promptroot workflows directly inside the editor. Currently at Phase 4 with Jules API integration (read-only).

## Design Principles

1. **Small, composable modules** - Each module has a clear, single responsibility
2. **Explicit types** - Use TypeScript with explicit types, avoid `any`
3. **VS Code API patterns** - Follow official VS Code extension guidelines
4. **Centralized configuration** - All IDs, keys, and constants in one place
5. **Minimal dependencies** - Prefer built-in Node.js and VS Code APIs

## Extension Structure

```
vscode-extension/
├── src/
│   ├── extension.ts        # Entry point (activate/deactivate)
│   ├── constants.ts         # Command IDs, view IDs, config keys
│   ├── tree-provider.ts     # Tree view provider for asset browsing
│   ├── jules-config.ts      # Jules API configuration & SecretStorage
│   ├── jules-client.ts      # Jules API HTTP client
│   └── test/                # Test files (future)
├── out/                     # Compiled JavaScript (generated)
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript configuration
├── .eslintrc.js             # ESLint configuration
└── README.md                # User-facing documentation
```

## Core Components

### Extension Entry Point (extension.ts)

The main entry point implements two required functions:

- `activate(context)` - Called when extension activates. Registers commands, views, and event handlers. All disposables must be added to context.subscriptions.
- `deactivate()` - Called when extension deactivates. Cleanup and resource disposal.

**Current Implementation (Phase 4):**
- Creates output channel for logging
- Initializes Jules configuration (SecretStorage)
- Initializes Jules API client
- Creates tree view provider for assets
- Registers seven commands: initialize, openDocs, browseAssets, refreshAssets, configureJulesApi, viewJulesSources, viewJulesSessions
- Logs activation and command execution to output channel
- Helper functions for viewing Jules sources and sessions with progress indicators

### Constants (constants.ts)

Centralized definitions for:
- Command IDs (e.g., `promptroot.initialize`)
- View IDs (e.g., `promptroot.assetsView`)
- Configuration keys (e.g., `promptroot.assetsPath`)
- Output channel name

**Why centralized?** Makes refactoring easier, prevents typos, provides single source of truth.

### Extension Manifest (package.json)

Declares:
- Extension metadata (name, version, publisher)
- Activation events (when extension loads)
- Contributed commands, views, and configuration
- Dependencies and build scripts

**Activation Events:**
- `onCommand:promptroot.initialize` - Activate on command execution
- `workspaceContains:**/prompts/**` - Activate when workspace contains prompts directory

## Phase 1-4 Implementation Details

### Commands

| Command ID | Title | Action |
|------------|-------|--------|
| `promptroot.initialize` | Promptroot: Initialize Workspace | Logs message, shows info notification |
| `promptroot.openDocs` | Promptroot: Open Documentation | Opens GitHub repo in browser |
| `promptroot.browseAssets` | Promptroot: Browse Assets | Focuses on assets tree view |
| `promptroot.refreshAssets` | Promptroot: Refresh Assets | Refreshes tree view from file system |
| `promptroot.configureJulesApi` | Promptroot: Configure Jules API | Prompts for API key, stores in SecretStorage |
| `promptroot.viewJulesSources` | Promptroot: View Jules Sources | Lists sources from Jules API |
| `promptroot.viewJulesSessions` | Promptroot: View Jules Sessions | Lists and displays session details |

### Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `promptroot.assetsPath` | string | "prompts" | Path to assets directory |
| `promptroot.autoDetect` | boolean | true | Auto-detect Promptroot workspaces |

### Views

| View ID | Location | Purpose |
|---------|----------|---------|
| `promptroot.assetsView` | Explorer sidebar | Tree view for browsing assets (Phase 2) |

## Development Workflow

### Building

```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript to JavaScript
npm run watch        # Watch mode for development
```

### Testing

```bash
npm run lint         # Run ESLint
npm run test         # Run unit tests (Phase 6)
```

### Running

Press F5 in VS Code to launch Extension Development Host with extension loaded.

### Debugging

- Set breakpoints in TypeScript source files
- Use Debug Console in Extension Development Host
- Check Output channel "Promptroot" for logs

## Extension Lifecycle

1. **Activation** - Triggered by activation events in package.json
2. **Command Registration** - Commands registered in activate()
3. **User Interaction** - Commands executed via Command Palette
4. **Logging** - All actions logged to output channel
5. **Deactivation** - Cleanup in deactivate()

## Future Phases

### Phase 5: Write Operations
- Commands to create new assets
- Template support
- File write confirmation

### Phase 6: Testing & Release
- Unit tests for core logic
- E2E tests for user flows
- Package extension (.vsix)
- Publish to marketplace

### Phase 7+: Advanced Features
- Jules API write operations
- Batch operations
- Advanced search
- Workspace synchronization

## Core Modules (Phase 4)

### Tree Provider (tree-provider.ts)

Implements VS Code's TreeDataProvider interface for the assets view.

**Classes:**
- `PromptrootTreeItem` - Represents a file or folder in the tree
  - Extends `vscode.TreeItem`
  - Sets icons, tooltips, and click behavior based on item type
  - Files are clickable (open in editor), folders are collapsible

- `PromptrootTreeProvider` - Provides tree data to VS Code
  - Implements `vscode.TreeDataProvider<PromptrootTreeItem>`
  - `detectPromptrootStructure()` - Finds workspace root with prompts/ directory
  - `getDirectoryChildren()` - Reads directory contents, filters .md files
  - `getChildren()` - Returns tree items for root or directory
  - `getTreeItem()` - Converts internal item to VS Code tree item
  - `refresh()` - Triggers tree update via event emitter

**Features:**
- Automatic workspace detection (looks for prompts/ directory)
- Folders sorted before files
- Click to open markdown files
- Refresh button in view title bar
- Error handling for invalid workspaces

### Jules Configuration (jules-config.ts)

Manages Jules API configuration using VS Code SecretStorage.

**Class:**
- `JulesConfig` - API key management wrapper
  - Constructor takes `vscode.ExtensionContext`
  - `hasApiKey()` - Check if API key is stored
  - `getApiKey()` - Retrieve stored API key
  - `setApiKey(key)` - Store API key securely
  - `clearApiKey()` - Delete stored API key
  - `promptForApiKey()` - Show input box for API key entry
  - `showConfigurationMenu()` - Quick Pick menu (set/clear/test)
  - `ensureApiKey()` - Get key or prompt if missing

**Features:**
- Secure storage via VS Code SecretStorage (encrypted)
- API key validation (non-empty, trimmed)
- User-friendly prompts and error messages
- Configuration menu with set/clear/test options

### Jules Client (jules-client.ts)

HTTP client for Jules API operations.

**Interfaces:**
- `JulesSource` - Source metadata (id, displayName, updateTime)
- `JulesSession` - Session metadata (name, displayName, updateTime, state)
- `ListSourcesResponse` - Response from /sources endpoint
- `ListSessionsResponse` - Response from /sessions endpoint

**Class:**
- `JulesClient` - HTTP client wrapper
  - Constructor takes API key and output channel
  - `listSources()` - GET /sources (list available sources)
  - `listSessions()` - GET /sessions (list user sessions)
  - `getSession(sessionName)` - GET /sessions/{sessionName} (session details)
  - `testApiKey()` - Test connection with API key
  - `fetchWithTimeout()` - Fetch wrapper with 10s timeout and AbortController

**Features:**
- Base URL: https://jules.googleapis.com/v1alpha
- Authentication via X-Goog-Api-Key header
- 10-second timeout for all requests
- Detailed error handling (network, HTTP, timeout)
- Logging to output channel
- Type-safe responses with TypeScript interfaces

## Dependencies

### Runtime
- `vscode` - VS Code Extension API (provided by VS Code)

### Development
- `typescript` - TypeScript compiler
- `@types/vscode` - VS Code API type definitions
- `@types/node` - Node.js type definitions
- `eslint` - Code linting
- `@typescript-eslint/*` - TypeScript-specific ESLint rules
- `@vscode/test-electron` - Extension testing (Phase 6)

## Security Considerations

- No external network calls except Jules API (Phase 4+)
- All file operations workspace-relative (Phase 3+)
- User confirmation before file writes (Phase 5)
- API keys stored in VS Code SecretStorage (encrypted, not in settings or code)
- Jules API key never logged or exposed in UI
- HTTPS-only for Jules API calls

## Code Quality Standards

- **TypeScript strict mode** - All strict checks enabled
- **ESLint** - Enforces naming conventions, semicolons, etc.
- **No `any` types** - Use explicit types or proper generics
- **Small functions** - Each function has single responsibility
- **Clear naming** - Functions, variables, types use descriptive names

## Testing Strategy (Phase 6)

- **Unit tests** - Test pure functions and logic
- **Integration tests** - Test command handlers and VS Code API integration
- **E2E tests** - Test complete user workflows
- **Manual testing** - Verify in Extension Development Host

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Promptroot Repository](https://github.com/jessewashburn/prompt-sharing)
