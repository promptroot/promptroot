# Promptroot VS Code Extension

A VS Code extension that streamlines Promptroot workflows directly inside the editor.

## Features

### Phase 1 (Current)
- Basic extension activation and command registration
- Three core commands:
  - `Promptroot: Initialize Workspace` - Initialize or validate Promptroot configuration
  - `Promptroot: Open Documentation` - Open Promptroot documentation
  - `Promptroot: Browse Assets` - Browse Promptroot assets (placeholder)
- Output channel for extension logging

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
