# Promptroot VS Code Extension

A VS Code extension that streamlines Promptroot workflows directly inside the editor.

## Features

### Current Features (Phase 6 - Production Ready)

#### Asset Management
- Tree view in Explorer sidebar showing all Promptroot assets
- Real-time file system integration (reads from `prompts/` directory)
- Click to open markdown files in editor
- Refresh button to reload asset tree
- Folder expansion with icons and tooltips

#### Core Commands
- `Promptroot: Initialize Workspace` - Initialize or validate Promptroot configuration
- `Promptroot: Open Documentation` - Open Promptroot documentation
- `Promptroot: Browse Assets` - Browse Promptroot assets in tree view
- `Promptroot: Refresh Assets` - Reload asset tree from file system
- `Promptroot: Create New Prompt Asset` - Create new prompt with template and metadata

#### Jules API Integration (Read-Only)
- `Promptroot: Configure Jules API` - Set up Jules API key (stored securely in SecretStorage)
- `Promptroot: View Jules Sources` - List available sources from Jules API
- `Promptroot: View Jules Sessions` - Browse sessions and view session details
- Secure API key storage using VS Code SecretStorage
- Error handling with user-friendly messages
- Progress indicators during API calls
- Quick Pick UI for browsing sources and sessions

#### Authoring & Templates
- **Create New Prompt Assets** - Guided workflow for creating new prompts
- **3 Template Types** - Basic, Task, and Tutorial templates
- **Metadata Collection** - Name, description, category, author
- **Preview Before Write** - See generated content before confirmation
- **Confirmation Required** - Modal dialog for file creation
- **Overwrite Protection** - Warns if file already exists
- **Auto-refresh** - Tree updates automatically after creation
- **Auto-open** - New files open in editor immediately

#### General
- Output channel for extension logging
- Automatic Promptroot workspace detection

## Installation

### Development
1. Navigate to the extension directory:
   ```
   cd vscode-extension
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Compile TypeScript:
   ```
   npm run compile
   ```

4. Press F5 in VS Code to launch Extension Development Host

## Usage

### Getting Started

1. **Open a Workspace** - Open a folder in VS Code that contains (or will contain) your Promptroot assets
2. **View Assets** - Look for "Promptroot Assets" in the Explorer sidebar
3. **Create Your First Prompt** - Click the "+" button in the tree view or use Command Palette

### Creating a New Prompt Asset

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Promptroot: Create New Prompt Asset"
3. Select a template:
   - **Basic Prompt** - Simple prompt with metadata
   - **Task Prompt** - Structured task with steps and verification
   - **Tutorial Prompt** - Comprehensive tutorial with learning objectives
4. Fill in metadata:
   - **Name** - Display name for your prompt
   - **Description** - Brief description of what it does
   - **Category** - Select from predefined categories
   - **Author** - Your name (defaults to system username)
5. Preview the generated content
6. Confirm creation - Click "Create" in the dialog

The new file will be:
- Created in `prompts/` directory
- Automatically opened in editor
- Visible in the tree view

### Working with Jules API

1. **Configure API Key**
   - Command: "Promptroot: Configure Jules API"
   - Select "Set API Key"
   - Enter your Jules API key (stored securely in VS Code)

2. **View Jules Sources**
   - Command: "Promptroot: View Jules Sources"
   - Lists all connected repositories

3. **View Jules Sessions**
   - Command: "Promptroot: View Jules Sessions"
   - Browse recent coding sessions with status indicators

### Tips

- Use the **refresh button** (↻) in tree view to reload assets from disk
- **Filename sanitization** - Spaces become hyphens, special characters removed
- **Overwrite protection** - Extension warns before replacing existing files
- **Check the Output channel** - View > Output > Select "Promptroot" for logs

## Configuration

- `promptroot.assetsPath` - Path to Promptroot assets directory (default: "prompts")
- `promptroot.autoDetect` - Automatically detect Promptroot workspaces (default: true)

## Testing

### Quick Test (No Installation Required)

1. **Compile the extension:**
   ```bash
   cd vscode-extension
   npm run compile
   ```

2. **Launch Extension Development Host:**
   - Open the `vscode-extension` folder in VS Code
   - Open **Run and Debug** panel (left sidebar)
   - Click the green **play button** next to "Run Extension"
   - A new VS Code window opens with the extension loaded

3. **Open a test workspace:**
   - In the Extension Development Host window: **File → Open Folder**
   - Choose `c:\Users\jesse\prompt-sharing` (or any folder with a `prompts/` directory)

4. **Verify functionality:**
   - Look for **"PROMPTROOT ASSETS"** in Explorer sidebar
   - Press **Ctrl+Shift+P** → **Promptroot: Create New Prompt Asset**
   - Check **View → Output** → Select **"Promptroot"** to see logs

### Run Unit Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

**Test Results (Phase 6):**
- ✅ 30/30 tests passing
- ✅ 98.9% coverage for templates.ts
- ✅ All functionality verified through manual E2E testing

## Development

### Scripts
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile automatically
- `npm run lint` - Run ESLint on source files
- `npm run test` - Run unit tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run package` - Package extension as .vsix file

### Architecture

The extension follows VS Code best practices:

- **src/extension.ts** - Main entry point, command registration
- **src/constants.ts** - Centralized command IDs, view IDs, configuration keys
- **src/tree-provider.ts** - Tree view for browsing Promptroot assets
- **src/templates.ts** - Asset templates and validation logic
- **src/asset-creator.ts** - Asset creation workflow orchestration
- **src/jules-config.ts** - Jules API configuration and key management
- **src/jules-client.ts** - HTTP client for Jules API
- **src/templates.test.ts** - Unit tests for templates module
- **out/** - Compiled JavaScript (generated, not committed)

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

### Code Conventions

- Use explicit TypeScript types (avoid `any`)
- Keep modules small and focused
- Follow VS Code extension API patterns
- All command IDs and config keys defined in constants.ts

## Requirements

- VS Code 1.85.0 or higher
- Node.js 20.x or higher

## Contributing

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
