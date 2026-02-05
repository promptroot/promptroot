import * as vscode from 'vscode';
import { COMMANDS, OUTPUT_CHANNEL_NAME, VIEWS } from './constants';
import { PromptrootTreeProvider } from './tree-provider';

let outputChannel: vscode.OutputChannel;
let treeProvider: PromptrootTreeProvider;

/**
 * Extension activation entry point.
 * This function is called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  // Initialize output channel for logging
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  outputChannel.appendLine('Promptroot extension activated');

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Initialize tree view provider
  treeProvider = new PromptrootTreeProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView(VIEWS.assets, {
    treeDataProvider: treeProvider
  });

  // Register commands
  const initializeCommand = vscode.commands.registerCommand(
    COMMANDS.initialize,
    () => {
      outputChannel.appendLine('Initialize command executed');
      vscode.window.showInformationMessage('Promptroot: Workspace initialized');
    }
  );

  const openDocsCommand = vscode.commands.registerCommand(
    COMMANDS.openDocs,
    () => {
      outputChannel.appendLine('Open docs command executed');
      vscode.env.openExternal(vscode.Uri.parse('https://github.com/jessewashburn/prompt-sharing'));
    }
  );

  const browseAssetsCommand = vscode.commands.registerCommand(
    COMMANDS.browseAssets,
    () => {
      outputChannel.appendLine('Browse assets command executed');
      vscode.window.showInformationMessage('Promptroot: Browse assets (placeholder)');
    }
  );

  const refreshAssetsCommand = vscode.commands.registerCommand(
    COMMANDS.refreshAssets,
    () => {
      outputChannel.appendLine('Refresh assets command executed');
      treeProvider.refresh();
      vscode.window.showInformationMessage('Promptroot: Assets refreshed');
    }
  );

  // Add commands to subscriptions for proper cleanup
  context.subscriptions.push(
    initializeCommand,
    openDocsCommand,
    browseAssetsCommand,
    refreshAssetsCommand,
    treeView,
    outputChannel
  );

  outputChannel.appendLine('All commands registered successfully');
  outputChannel.appendLine('Tree view provider registered');
}

/**
 * Extension deactivation cleanup.
 * This function is called when the extension is deactivated.
 */
export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('Promptroot extension deactivated');
    outputChannel.dispose();
  }
}
