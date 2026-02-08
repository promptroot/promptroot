import * as vscode from 'vscode';
import { COMMANDS, OUTPUT_CHANNEL_NAME, VIEWS } from './constants';
import { PromptrootTreeProvider } from './tree-provider';
import { JulesConfig } from './jules-config';
import { JulesClient } from './jules-client';
import { createNewPromptAsset } from './asset-creator';
import { initializeFirebase, disposeFirebase } from './firebase-config';
import { AuthManager } from './auth-manager';
import { FirestoreService } from './firestore-service';
import { QueueTreeProvider } from './queue-tree-provider';
import { QueueManager } from './queue-manager';

let outputChannel: vscode.OutputChannel;
let treeProvider: PromptrootTreeProvider;
let queueTreeProvider: QueueTreeProvider | null = null;
let julesConfig: JulesConfig;
let julesClient: JulesClient;
let authManager: AuthManager | null = null;
let firestoreService: FirestoreService | null = null;
let queueManager: QueueManager | null = null;
let statusBarItem: vscode.StatusBarItem;

/**
 * Extension activation entry point.
 * This function is called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext) {
  // Initialize output channel for logging
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  outputChannel.appendLine('Promptroot extension activated');

  // Initialize Firebase
  try {
    initializeFirebase(context);
    outputChannel.appendLine('Firebase initialized successfully');
  } catch (error) {
    outputChannel.appendLine(`Firebase initialization failed: ${error}`);
    vscode.window.showWarningMessage('Firebase initialization failed. Some features may not work.');
  }

  // Initialize authentication manager
  authManager = new AuthManager(context, outputChannel);
  firestoreService = new FirestoreService(outputChannel);

  // Initialize queue manager
  queueManager = new QueueManager(firestoreService, authManager, outputChannel);

  // Create status bar item for user display
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = COMMANDS.viewProfile;
  updateStatusBar(null); // Show "Sign In" initially
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Listen to auth state changes
  authManager.onAuthStateChanged((user) => {
    updateStatusBar(user);
    if (user) {
      onUserSignedIn(user);
    }
  });

  // Initialize Jules services
  julesConfig = new JulesConfig(context);
  julesClient = new JulesClient(outputChannel);

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Initialize tree view provider
  treeProvider = new PromptrootTreeProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView(VIEWS.assets, {
    treeDataProvider: treeProvider
  });

  // Initialize queue tree view provider
  queueTreeProvider = new QueueTreeProvider(firestoreService, authManager, outputChannel);
  const queueTreeView = vscode.window.createTreeView(VIEWS.queue, {
    treeDataProvider: queueTreeProvider,
    showCollapseAll: true
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

  // Create asset command
  const createAssetCommand = vscode.commands.registerCommand(
    COMMANDS.createAsset,
    async () => {
      outputChannel.appendLine('Create asset command executed');
      
      // Get current workspace root (in case it changed after activation)
      const currentWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      
      outputChannel.appendLine(`Current workspace root: ${currentWorkspaceRoot}`);
      outputChannel.appendLine(`Workspace folders: ${JSON.stringify(vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath))}`);
      
      if (!currentWorkspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
        return;
      }
      
      await createNewPromptAsset(
        currentWorkspaceRoot,
        outputChannel,
        () => treeProvider.refresh() // Refresh tree after creation
      );
    }
  );

  // Jules API commands
  const configureJulesApiCommand = vscode.commands.registerCommand(
    COMMANDS.configureJulesApi,
    async () => {
      outputChannel.appendLine('Configure Jules API command executed');
      await julesConfig.showConfigurationMenu();
    }
  );

  const viewJulesSourcesCommand = vscode.commands.registerCommand(
    COMMANDS.viewJulesSources,
    async () => {
      outputChannel.appendLine('View Jules sources command executed');
      await viewJulesSources();
    }
  );

  const viewJulesSessionsCommand = vscode.commands.registerCommand(
    COMMANDS.viewJulesSessions,
    async () => {
      outputChannel.appendLine('View Jules sessions command executed');
      await viewJulesSessions();
    }
  );

  // Authentication commands
  const signInCommand = vscode.commands.registerCommand(
    COMMANDS.signIn,
    async () => {
      outputChannel.appendLine('Sign in command executed');
      if (authManager?.isSignedIn()) {
        vscode.window.showInformationMessage('Already signed in');
        return;
      }
      try {
        await authManager?.signIn();
      } catch (error) {
        outputChannel.appendLine(`Sign in failed: ${error}`);
      }
    }
  );

  const signOutCommand = vscode.commands.registerCommand(
    COMMANDS.signOut,
    async () => {
      outputChannel.appendLine('Sign out command executed');
      if (!authManager?.isSignedIn()) {
        vscode.window.showInformationMessage('Not signed in');
        return;
      }
      try {
        await authManager?.signOut();
      } catch (error) {
        outputChannel.appendLine(`Sign out failed: ${error}`);
      }
    }
  );

  const viewProfileCommand = vscode.commands.registerCommand(
    COMMANDS.viewProfile,
    async () => {
      outputChannel.appendLine('View profile command executed');
      await showUserProfile();
    }
  );

  // Queue commands
  const refreshQueueCommand = vscode.commands.registerCommand(
    COMMANDS.refreshQueue,
    () => {
      outputChannel.appendLine('Refresh queue command executed');
      queueTreeProvider?.refresh();
    }
  );

  const addToQueueCommand = vscode.commands.registerCommand(
    COMMANDS.addToQueue,
    async (uri?: vscode.Uri) => {
      outputChannel.appendLine('Add to queue command executed');
      await addToQueue(uri);
    }
  );

  const deleteQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.deleteQueueItem,
    async (item) => {
      outputChannel.appendLine('Delete queue item command executed');
      await deleteQueueItem(item);
    }
  );

  const pauseQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.pauseQueueItem,
    async (item) => {
      outputChannel.appendLine('Pause queue item command executed');
      await pauseQueueItem(item);
    }
  );

  const resumeQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.resumeQueueItem,
    async (item) => {
      outputChannel.appendLine('Resume queue item command executed');
      await resumeQueueItem(item);
    }
  );

  const runQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.runQueueItem,
    async (item) => {
      outputChannel.appendLine('Run queue item command executed');
      await runQueueItem(item);
    }
  );

  // Add commands to subscriptions for proper cleanup
  context.subscriptions.push(
    initializeCommand,
    openDocsCommand,
    browseAssetsCommand,
    refreshAssetsCommand,
    createAssetCommand,
    configureJulesApiCommand,
    viewJulesSourcesCommand,
    viewJulesSessionsCommand,
    signInCommand,
    signOutCommand,
    viewProfileCommand,
    refreshQueueCommand,
    addToQueueCommand,
    deleteQueueItemCommand,
    pauseQueueItemCommand,
    resumeQueueItemCommand,
    runQueueItemCommand,
    treeView,
    queueTreeView,
    outputChannel
  );

  // Register disposables
  if (authManager) {
    context.subscriptions.push(authManager);
  }
  if (firestoreService) {
    context.subscriptions.push(firestoreService);
  }
  if (queueTreeProvider) {
    context.subscriptions.push(queueTreeProvider);
  }

  outputChannel.appendLine('All commands registered successfully');
  outputChannel.appendLine('Tree view provider registered');
  outputChannel.appendLine('Jules API integration ready');
  outputChannel.appendLine('Firebase and Authentication ready');
}

/**
 * View Jules sources (connected repositories) in Quick Pick.
 */
async function viewJulesSources(): Promise<void> {
  const apiKey = await julesConfig.ensureApiKey();
  if (!apiKey) {
    return; // User cancelled
  }

  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Loading Jules sources...',
      cancellable: false
    }, async () => {
      const response = await julesClient.listSources(apiKey);
      
      if (!response.sources || response.sources.length === 0) {
        vscode.window.showInformationMessage('No Jules sources found. Connect repositories via the Jules GitHub App.');
        return;
      }

      const items = response.sources.map(source => ({
        label: source.displayName,
        description: source.name,
        detail: `Created: ${source.createTime || 'Unknown'}`
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Jules source',
        title: `Jules Sources (${response.sources.length})`
      });

      if (selected) {
        outputChannel.appendLine(`Selected source: ${selected.label}`);
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load Jules sources: ${error}`);
  }
}

/**
 * View Jules sessions (recent coding tasks) in Quick Pick.
 */
async function viewJulesSessions(): Promise<void> {
  const apiKey = await julesConfig.ensureApiKey();
  if (!apiKey) {
    return; // User cancelled
  }

  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Loading Jules sessions...',
      cancellable: false
    }, async () => {
      const response = await julesClient.listSessions(apiKey, 10);
      
      if (!response.sessions || response.sessions.length === 0) {
        vscode.window.showInformationMessage('No Jules sessions found. Create your first session via the Jules web interface.');
        return;
      }

      const stateEmoji: Record<string, string> = {
        'COMPLETED': '✅',
        'FAILED': '❌',
        'IN_PROGRESS': '⏳',
        'PLANNING': '📋',
        'QUEUED': '⏸️'
      };

      const items = response.sessions.map(session => ({
        label: `${stateEmoji[session.state] || '❓'} ${session.title || 'Untitled'}`,
        description: session.state,
        detail: session.prompt.substring(0, 80) + (session.prompt.length > 80 ? '...' : ''),
        session: session
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Jules session',
        title: `Recent Jules Sessions (${response.sessions.length})`
      });

      if (selected) {
        outputChannel.appendLine(`Selected session: ${selected.session.name}`);
        // Could open session details in future
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load Jules sessions: ${error}`);
  }
}

/**
 * Update status bar with current user info
 */
function updateStatusBar(user: any | null): void {
  if (user) {
    const displayName = user.displayName || user.email || 'User';
    statusBarItem.text = `$(account) ${displayName}`;
    statusBarItem.tooltip = `Signed in as ${user.email}\nClick to view profile`;
  } else {
    statusBarItem.text = `$(account) Sign In`;
    statusBarItem.tooltip = 'Click to sign in with GitHub';
  }
}

/**
 * Handle user signed in event
 */
async function onUserSignedIn(user: any): Promise<void> {
  try {
    // Load or create user profile in Firestore
    const profile = await firestoreService?.getUserProfile(user.uid);
    
    if (!profile) {
      // Create new profile
      await firestoreService?.saveUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
      outputChannel.appendLine(`Created new user profile: ${user.uid}`);
    } else {
      // Update last login time
      await firestoreService?.saveUserProfile({
        uid: user.uid
      });
      outputChannel.appendLine(`Updated user profile: ${user.uid}`);
    }
  } catch (error) {
    outputChannel.appendLine(`Error handling user sign-in: ${error}`);
  }
}

/**
 * Show user profile information
 */
async function showUserProfile(): Promise<void> {
  const user = authManager?.getCurrentUser();
  
  if (!user) {
    const action = await vscode.window.showInformationMessage(
      'Not signed in',
      'Sign In'
    );
    if (action === 'Sign In') {
      vscode.commands.executeCommand(COMMANDS.signIn);
    }
    return;
  }

  try {
    const profile = await firestoreService?.getUserProfile(user.uid);
    
    const items: vscode.QuickPickItem[] = [
      {
        label: '$(account) User Information',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: 'Email',
        description: user.email || 'Not available'
      },
      {
        label: 'Display Name',
        description: user.displayName || 'Not set'
      },
      {
        label: 'User ID',
        description: user.uid
      }
    ];

    if (profile) {
      items.push(
        {
          label: '$(settings-gear) Preferences',
          kind: vscode.QuickPickItemKind.Separator
        },
        {
          label: 'Timezone',
          description: profile.timezone || 'Not set'
        },
        {
          label: 'Default Repository',
          description: profile.defaultRepo || 'Not set'
        },
        {
          label: 'Default Branch',
          description: profile.defaultBranch || 'Not set'
        }
      );
    }

    items.push(
      {
        label: '$(sign-out) Actions',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: '$(sign-out) Sign Out',
        description: 'Sign out of Promptroot'
      }
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: 'User Profile',
      placeHolder: 'View profile information'
    });

    if (selected?.label === '$(sign-out) Sign Out') {
      vscode.commands.executeCommand(COMMANDS.signOut);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load profile: ${error}`);
  }
}

/**
 * Add prompt(s) to Jules queue
 */
async function addToQueue(uri?: vscode.Uri): Promise<void> {
  if (!authManager?.isSignedIn()) {
    const action = await vscode.window.showInformationMessage(
      'You must be signed in to add items to the queue',
      'Sign In'
    );
    if (action === 'Sign In') {
      vscode.commands.executeCommand(COMMANDS.signIn);
    }
    return;
  }

  try {
    // Get the file to add
    let filePath: string;
    
    if (uri) {
      // Called from context menu
      filePath = uri.fsPath;
    } else {
      // Called from command palette - get active editor
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('No file selected. Open a file or right-click a prompt in the explorer.');
        return;
      }
      filePath = activeEditor.document.uri.fsPath;
    }

    // Verify it's a prompt file
    if (!filePath.endsWith('.md')) {
      vscode.window.showWarningMessage('Only markdown (.md) files can be added to the queue');
      return;
    }

    // Get workspace-relative path
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const relativePath = filePath.replace(workspaceFolder.uri.fsPath, '').replace(/^[\\/]/, '');

    // Get branch name
    const branch = await vscode.window.showInputBox({
      prompt: 'Enter branch name for this queue item',
      value: queueManager?.getSuggestedBranch(),
      placeHolder: 'jules-2024-01-01-12-00-00'
    });

    if (!branch) {
      return; // User cancelled
    }

    // Add to queue
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Adding to queue...',
      cancellable: false
    }, async () => {
      const id = await queueManager?.addToQueue(relativePath, branch);
      vscode.window.showInformationMessage(`Added to queue: ${relativePath} (${id})`);
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add to queue: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete queue item
 */
async function deleteQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete queue item?`,
    { modal: true },
    'Delete'
  );

  if (confirm !== 'Delete') {
    return;
  }

  try {
    await queueManager?.deleteQueueItem(item.queueItem.id);
    vscode.window.showInformationMessage('Queue item deleted');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Pause queue item
 */
async function pauseQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  try {
    await queueManager?.pauseQueueItem(item.queueItem.id);
    vscode.window.showInformationMessage('Queue item paused');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to pause queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Resume queue item
 */
async function resumeQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  try {
    await queueManager?.resumeQueueItem(item.queueItem.id);
    vscode.window.showInformationMessage('Queue item resumed');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to resume queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run queue item
 */
async function runQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  try {
    // Run in background with progress notification
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Running queue item...`,
      cancellable: false
    }, async () => {
      await queueManager?.runQueueItem(item.queueItem.id);
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extension deactivation cleanup.
 * This function is called when the extension is deactivated.
 */
export function deactivate() {
  // Dispose Firebase resources
  disposeFirebase();
  
  if (outputChannel) {
    outputChannel.appendLine('Promptroot extension deactivated');
    outputChannel.dispose();
  }
}
