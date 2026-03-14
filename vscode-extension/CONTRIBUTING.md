# Contributing to Promptroot VS Code Extension

## Development Setup

```bash
cd vscode-extension
npm install
npm run compile
```

Press **F5** in VS Code to launch the Extension Development Host.

## Scripts

```bash
npm run compile     # Compile TypeScript
npm run watch       # Watch mode compilation
npm run lint        # Run ESLint
npm test            # Run unit tests (84 passing)
npm run test:watch  # Test watch mode
npm run package     # Create .vsix package
```

## Architecture

- **TypeScript** — strict typing with explicit types
- **Modular Design** — small, focused modules with single responsibility
- **VS Code API** — follows official extension guidelines
- **Firebase SDK** — Auth, Firestore with retry logic and caching
- **Error Handling** — comprehensive categorization with recovery suggestions

## Testing

- **Unit Tests:** 84 passing tests with targeted coverage on critical modules
- **Manual Testing:** Press F5 to launch Extension Development Host
- See [TESTING.md](./TESTING.md) for complete testing instructions

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and ESLint rules
4. Add unit tests for new features
5. Test manually with the Extension Development Host
6. Submit a pull request with a clear description
