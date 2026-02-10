"use strict";
/**
 * Vitest Test Setup
 * Mock VS Code API for unit tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Mock VS Code module
const vscode = {
    window: {
        showInformationMessage: vitest_1.vi.fn(),
        showWarningMessage: vitest_1.vi.fn(),
        showErrorMessage: vitest_1.vi.fn(),
        createOutputChannel: vitest_1.vi.fn(() => ({
            appendLine: vitest_1.vi.fn(),
            append: vitest_1.vi.fn(),
            clear: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
            hide: vitest_1.vi.fn(),
            dispose: vitest_1.vi.fn(),
            name: 'Test',
            replace: vitest_1.vi.fn(),
        })),
        showQuickPick: vitest_1.vi.fn(),
        showInputBox: vitest_1.vi.fn(),
        withProgress: vitest_1.vi.fn(),
        createStatusBarItem: vitest_1.vi.fn(() => ({
            text: '',
            tooltip: '',
            show: vitest_1.vi.fn(),
            hide: vitest_1.vi.fn(),
            dispose: vitest_1.vi.fn(),
            command: '',
        })),
        createTreeView: vitest_1.vi.fn(() => ({
            reveal: vitest_1.vi.fn(),
            dispose: vitest_1.vi.fn(),
        })),
        registerTreeDataProvider: vitest_1.vi.fn(),
        createWebviewPanel: vitest_1.vi.fn(() => ({
            webview: {
                html: '',
                postMessage: vitest_1.vi.fn(),
                onDidReceiveMessage: vitest_1.vi.fn(),
                asWebviewUri: vitest_1.vi.fn((uri) => uri),
            },
            dispose: vitest_1.vi.fn(),
            onDidDispose: vitest_1.vi.fn(),
        })),
    },
    workspace: {
        workspaceFolders: [],
        getConfiguration: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn(),
            has: vitest_1.vi.fn(),
            inspect: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
        })),
        onDidChangeConfiguration: vitest_1.vi.fn(),
        findFiles: vitest_1.vi.fn(),
    },
    commands: {
        registerCommand: vitest_1.vi.fn(),
        executeCommand: vitest_1.vi.fn(),
    },
    Uri: {
        file: vitest_1.vi.fn((path) => ({ fsPath: path, path, scheme: 'file' })),
        parse: vitest_1.vi.fn((path) => ({ fsPath: path, path, scheme: 'file' })),
        joinPath: vitest_1.vi.fn((...parts) => ({ fsPath: parts.join('/'), path: parts.join('/'), scheme: 'file' })),
    },
    TreeItem: class TreeItem {
        constructor(label, collapsibleState) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2,
    },
    EventEmitter: class EventEmitter {
        constructor() {
            this.listeners = [];
            this.event = (listener) => {
                this.listeners.push(listener);
                return { dispose: vitest_1.vi.fn() };
            };
            this.fire = (data) => {
                this.listeners.forEach(l => l(data));
            };
        }
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
    },
    ProgressLocation: {
        Notification: 15,
        Window: 10,
        SourceControl: 1,
    },
    ExtensionContext: class ExtensionContext {
    },
};
// Make vscode available globally
vitest_1.vi.mock('vscode', () => vscode);
//# sourceMappingURL=test-setup.js.map