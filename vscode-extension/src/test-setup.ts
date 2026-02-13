/**
 * Vitest Test Setup
 * Mock VS Code API for unit tests
 */

import { vi } from 'vitest';

// Mock VS Code module
const vscode = {
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      name: 'Test',
      replace: vi.fn(),
    })),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    withProgress: vi.fn(),
    createStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      command: '',
    })),
    createTreeView: vi.fn(() => ({
      reveal: vi.fn(),
      dispose: vi.fn(),
    })),
    registerTreeDataProvider: vi.fn(),
    createWebviewPanel: vi.fn(() => ({
      webview: {
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn((uri) => uri),
      },
      dispose: vi.fn(),
      onDidDispose: vi.fn(),
    })),
  },
  workspace: {
    workspaceFolders: [],
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(),
    findFiles: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
  },
  Uri: {
    file: vi.fn((path) => ({ fsPath: path, path, scheme: 'file' })),
    parse: vi.fn((path) => ({ fsPath: path, path, scheme: 'file' })),
    joinPath: vi.fn((...parts) => ({ fsPath: parts.join('/'), path: parts.join('/'), scheme: 'file' })),
  },
  TreeItem: class TreeItem {
    constructor(public label: string, public collapsibleState?: number) {}
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  EventEmitter: class EventEmitter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private listeners: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event = (listener: any) => {
      this.listeners.push(listener);
      return { dispose: vi.fn() };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fire = (data: any) => {
      this.listeners.forEach(l => l(data));
    };
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
  ExtensionContext: class ExtensionContext {},
};

// Make vscode available globally
vi.mock('vscode', () => vscode);
