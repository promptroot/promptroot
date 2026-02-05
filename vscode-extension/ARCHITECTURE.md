# Promptroot VS Code Extension Architecture

**Version:** 1.0  
**Last Updated:** February 4, 2026

## Overview

This document describes the architecture of the Promptroot VS Code extension, designed to streamline Promptroot workflows directly inside the editor.

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

**Current Implementation:**
- Creates output channel for logging
- Registers three commands: initialize, openDocs, browseAssets
- Logs activation and command execution to output channel

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

## Phase 1 Implementation Details

### Commands

| Command ID | Title | Action |
|------------|-------|--------|
| `promptroot.initialize` | Promptroot: Initialize Workspace | Logs message, shows info notification |
| `promptroot.openDocs` | Promptroot: Open Documentation | Opens GitHub repo in browser |
| `promptroot.browseAssets` | Promptroot: Browse Assets | Placeholder notification |

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

### Phase 2: UI Surface
- Implement tree view provider for assets view
- Add more commands for asset operations

### Phase 3: Promptroot Integration
- Detect workspace structure (prompts/ directory)
- Read markdown files from disk
- Populate tree view with real data
- Add validation and error handling

### Phase 4: Jules API Integration
- Add Jules API configuration settings
- Implement read-only API calls
- Display API data in extension

### Phase 5: Write Operations
- Commands to create new assets
- Template support
- File write confirmation

### Phase 6: Testing & Release
- Unit tests for core logic
- E2E tests for user flows
- Package extension (.vsix)
- Publish to marketplace

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

- No external network calls in Phase 1
- All file operations workspace-relative (Phase 3+)
- User confirmation before file writes (Phase 5)
- No API keys in code (Phase 4+ will use VS Code SecretStorage)

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
