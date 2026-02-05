# Promptroot VS Code Extension

A VS Code extension that streamlines Promptroot workflows directly inside the editor.

## Features

### Current Features (Phase 5)

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

Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and search for "Promptroot" to see available commands.

## Configuration

- `promptroot.assetsPath` - Path to Promptroot assets directory (default: "prompts")
- `promptroot.autoDetect` - Automatically detect Promptroot workspaces (default: true)

## Development

### Scripts
- `npm run compile` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile automatically
- `npm run lint` - Run ESLint on source files
- `npm run test` - Run tests

### Architecture

The extension follows VS Code best practices:

- **src/extension.ts** - Main entry point, activation/deactivation
- **src/constants.ts** - Centralized command IDs, view IDs, configuration keys
- **out/** - Compiled JavaScript (generated, not committed)

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

## License

AGPL-3.0-only
