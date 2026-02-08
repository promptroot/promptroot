import * as vscode from 'vscode';
import * as path from 'path';
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
import { SchedulePickerView } from './schedule-picker-view';
import { SessionTreeProvider } from './session-tree-provider';
import { SessionDetailsView } from './session-details-view';

let outputChannel: vscode.OutputChannel;
let treeProvider: PromptrootTreeProvider;
let queueTreeProvider: QueueTreeProvider | null = null;
let sessionTreeProvider: SessionTreeProvider | null = null;
let julesConfig: JulesConfig;
let julesClient: JulesClient;
let authManager: AuthManager | null = null;
let firestoreService: FirestoreService | null = null;
let queueManager: QueueManager | null = null;
let schedulePickerView: SchedulePickerView | null = null;
let sessionDetailsView: SessionDetailsView | null = null;
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

  // Initialize schedule picker view
  schedulePickerView = new SchedulePickerView(context);

  // Initialize session details view  
  sessionDetailsView = new SessionDetailsView(context);

  // Initialize session details view
  sessionDetailsView = new SessionDetailsView(context);

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

  // Initialize session tree view provider
  sessionTreeProvider = new SessionTreeProvider(firestoreService, authManager, outputChannel);
  const sessionTreeView = vscode.window.createTreeView(VIEWS.sessions, {
    treeDataProvider: sessionTreeProvider,
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

  const addBatchToQueueCommand = vscode.commands.registerCommand(
    COMMANDS.addBatchToQueue,
    async () => {
      outputChannel.appendLine('Add batch to queue command executed');
      await addBatchToQueue();
    }
  );

  const runNextPendingCommand = vscode.commands.registerCommand(
    COMMANDS.runNextPending,
    async () => {
      outputChannel.appendLine('Run next pending command executed');
      await runNextPending();
    }
  );

  const runAllPendingCommand = vscode.commands.registerCommand(
    COMMANDS.runAllPending,
    async () => {
      outputChannel.appendLine('Run all pending command executed');
      await runAllPending();
    }
  );

  const clearCompletedCommand = vscode.commands.registerCommand(
    COMMANDS.clearCompleted,
    async () => {
      outputChannel.appendLine('Clear completed command executed');
      await clearCompleted();
    }
  );

  const clearFailedCommand = vscode.commands.registerCommand(
    COMMANDS.clearFailed,
    async () => {
      outputChannel.appendLine('Clear failed command executed');
      await clearFailed();
    }
  );

  const viewQueueItemDetailsCommand = vscode.commands.registerCommand(
    COMMANDS.viewQueueItemDetails,
    async (item) => {
      outputChannel.appendLine('View queue item details command executed');
      await viewQueueItemDetails(item);
    }
  );

  const scheduleQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.scheduleQueueItem,
    async (item) => {
      outputChannel.appendLine('Schedule queue item command executed');
      await scheduleQueueItem(item);
    }
  );

  const unscheduleQueueItemCommand = vscode.commands.registerCommand(
    COMMANDS.unscheduleQueueItem,
    async (item) => {
      outputChannel.appendLine('Unschedule queue item command executed');
      await unscheduleQueueItem(item);
    }
  );

  const setTimezoneCommand = vscode.commands.registerCommand(
    COMMANDS.setTimezone,
    async () => {
      outputChannel.appendLine('Set timezone command executed');
      await setTimezone();
    }
  );

  const refreshSessionsCommand = vscode.commands.registerCommand(
    COMMANDS.refreshSessions,
    () => {
      outputChannel.appendLine('Refresh sessions command executed');
      sessionTreeProvider?.refresh();
    }
  );

  const viewSessionDetailsCommand = vscode.commands.registerCommand(
    COMMANDS.viewSessionDetails,
    async (item) => {
      outputChannel.appendLine('View session details command executed');
      await viewSessionDetails(item);
    }
  );

  const openPRInBrowserCommand = vscode.commands.registerCommand(
    COMMANDS.openPRInBrowser,
    async (prUrl) => {
      outputChannel.appendLine('Open PR in browser command executed');
      if (typeof prUrl === 'string') {
        await vscode.env.openExternal(vscode.Uri.parse(prUrl));
      } else if (prUrl?.session?.pr?.url) {
        await vscode.env.openExternal(vscode.Uri.parse(prUrl.session.pr.url));
      } else {
        vscode.window.showErrorMessage('No PR URL available');
      }
    }
  );

  const viewAnalyticsCommand = vscode.commands.registerCommand(
    COMMANDS.viewAnalytics,
    async () => {
      outputChannel.appendLine('View analytics command executed');
      vscode.window.showInformationMessage('Analytics dashboard coming soon!');
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
    addBatchToQueueCommand,
    runNextPendingCommand,
    runAllPendingCommand,
    clearCompletedCommand,
    clearFailedCommand,
    viewQueueItemDetailsCommand,
    scheduleQueueItemCommand,
    unscheduleQueueItemCommand,
    setTimezoneCommand,
    refreshSessionsCommand,
    viewSessionDetailsCommand,
    openPRInBrowserCommand,
    viewAnalyticsCommand,
    treeView,
    queueTreeView,
    sessionTreeView,
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
  if (sessionTreeProvider) {
    context.subscriptions.push(sessionTreeProvider);
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
 * Add multiple prompts to queue as batch
 */
async function addBatchToQueue(): Promise<void> {
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
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Find all markdown files in workspace
    const files = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**', 100);
    
    if (files.length === 0) {
      vscode.window.showInformationMessage('No markdown files found in workspace');
      return;
    }

    // Create quick pick items
    const items = files.map(file => {
      const relativePath = file.fsPath.replace(workspaceFolder.uri.fsPath, '').replace(/^[\\/]/, '');
      return {
        label: path.basename(file.fsPath),
        description: relativePath,
        picked: false,
        file: relativePath
      };
    });

    // Show multi-select quick pick
    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select prompts to add to queue (multiple selection)',
      title: 'Add Batch to Jules Queue'
    });

    if (!selected || selected.length === 0) {
      return;
    }

    // Get branch name
    const branch = await vscode.window.showInputBox({
      prompt: 'Enter branch name for batch queue items',
      value: queueManager?.getSuggestedBranch(),
      placeHolder: 'jules-2024-01-01-12-00-00'
    });

    if (!branch) {
      return;
    }

    // Add batch to queue
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Adding ${selected.length} prompts to queue...`,
      cancellable: false
    }, async () => {
      const promptPaths = selected.map(item => item.file);
      const id = await queueManager?.addBatchToQueue(promptPaths, branch);
      vscode.window.showInformationMessage(`Added batch to queue: ${selected.length} prompts (${id})`);
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add batch to queue: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run next pending queue item
 */
async function runNextPending(): Promise<void> {
  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to run queue items');
    return;
  }

  try {
    const queueItems = queueTreeProvider?.getQueueItems() || [];
    await queueManager?.runNextPending(queueItems);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run next pending: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Run all pending queue items
 */
async function runAllPending(): Promise<void> {
  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to run queue items');
    return;
  }

  try {
    const queueItems = queueTreeProvider?.getQueueItems() || [];
    await queueManager?.runAllPending(queueItems);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run all pending: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear completed queue items
 */
async function clearCompleted(): Promise<void> {
  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to clear queue items');
    return;
  }

  try {
    const queueItems = queueTreeProvider?.getQueueItems() || [];
    await queueManager?.clearCompleted(queueItems);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to clear completed items: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear failed queue items
 */
async function clearFailed(): Promise<void> {
  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to clear queue items');
    return;
  }

  try {
    const queueItems = queueTreeProvider?.getQueueItems() || [];
    await queueManager?.clearFailed(queueItems);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to clear failed items: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * View queue item details in QuickPick
 */
async function viewQueueItemDetails(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  const queueItem = item.queueItem;
  const items: vscode.QuickPickItem[] = [
    {
      label: '$(info) Queue Item Details',
      kind: vscode.QuickPickItemKind.Separator
    },
    {
      label: 'ID',
      description: queueItem.id
    },
    {
      label: 'Type',
      description: queueItem.type
    },
    {
      label: 'Status',
      description: queueItem.status
    },
    {
      label: 'Branch',
      description: queueItem.branch
    },
    {
      label: 'Source ID',
      description: queueItem.sourceId
    },
    {
      label: 'Created',
      description: queueItem.createdAt.toDate().toLocaleString()
    },
    {
      label: 'Updated',
      description: queueItem.updatedAt.toDate().toLocaleString()
    }
  ];

  if (queueItem.type === 'single') {
    items.push(
      {
        label: '$(file) Prompt Details',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: 'Prompt Path',
        description: queueItem.promptPath
      }
    );

    if (queueItem.sessionId) {
      items.push({
        label: 'Session ID',
        description: queueItem.sessionId
      });
    }

    if (queueItem.scheduledAt) {
      items.push({
        label: 'Scheduled At',
        description: queueItem.scheduledAt.toDate().toLocaleString()
      });
    }

    if (queueItem.scheduledTimeZone) {
      items.push({
        label: 'Timezone',
        description: queueItem.scheduledTimeZone
      });
    }
  } else {
    items.push(
      {
        label: '$(list-tree) Batch Details',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: 'Total Subtasks',
        description: queueItem.subtasks.length.toString()
      },
      {
        label: 'Completed',
        description: (queueItem.completedCount || 0).toString()
      },
      {
        label: 'Failed',
        description: (queueItem.failedCount || 0).toString()
      }
    );
  }

  if (queueItem.lastError) {
    items.push(
      {
        label: '$(error) Error Information',
        kind: vscode.QuickPickItemKind.Separator
      },
      {
        label: 'Error Message',
        description: queueItem.lastError.message
      },
      {
        label: 'Error Time',
        description: queueItem.lastError.timestamp.toDate().toLocaleString()
      }
    );

    if (queueItem.lastError.itemIndex !== undefined) {
      items.push({
        label: 'Failed Subtask Index',
        description: queueItem.lastError.itemIndex.toString()
      });
    }
  }

  await vscode.window.showQuickPick(items, {
    title: `Queue Item: ${queueItem.type === 'single' ? queueItem.promptPath : 'Batch'}`,
    placeHolder: 'Queue item details'
  });
}

/**
 * Schedule queue item for future execution
 */
async function scheduleQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to schedule queue items');
    return;
  }

  try {
    // Get user's timezone preference
    const profile = await firestoreService?.getUserProfile(authManager.getCurrentUser()!.uid);
    const userTimezone = profile?.timezone || 'America/Los_Angeles';

    //Show schedule picker
    const result = await schedulePickerView?.show(userTimezone);
    
    if (!result) {
      return; // User cancelled
    }

    // Update queue item with schedule
    await queueManager?.scheduleQueueItem(item.queueItem.id, result.scheduledAt);

    // Update user timezone if changed
    if (result.timezone !== userTimezone) {
      await firestoreService?.saveUserProfile({
        uid: authManager.getCurrentUser()!.uid,
        timezone: result.timezone
      });
      outputChannel.appendLine(`Updated user timezone to: ${result.timezone}`);
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to schedule queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Unschedule queue item (change status back to pending)
 */
async function unscheduleQueueItem(item: any): Promise<void> {
  if (!item?.queueItem) {
    return;
  }

  if (!authManager?.isSignedIn()) {
    vscode.window.showInformationMessage('You must be signed in to unschedule queue items');
    return;
  }

  try {
    const user = authManager.getCurrentUser();
    if (!user) {
      return;
    }

    // Update queue item - remove schedule and set back to pending
    await firestoreService?.updateQueueItem(user.uid, item.queueItem.id, {
      status: 'pending',
      scheduledAt: null,
      scheduledTimeZone: null
    } as any);

    vscode.window.showInformationMessage('Queue item unscheduled');
    outputChannel.appendLine(`Unscheduled queue item: ${item.queueItem.id}`);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to unschedule queue item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Set user timezone preference
 */
async function setTimezone(): Promise<void> {
  if (!authManager?.isSignedIn()) {
    const action = await vscode.window.showInformationMessage(
      'You must be signed in to set timezone',
      'Sign In'
    );
    if (action === 'Sign In') {
      vscode.commands.executeCommand(COMMANDS.signIn);
    }
    return;
  }

  const commonTimezones = [
    { label: 'Pacific Time', value: 'America/Los_Angeles' },
    { label: 'Mountain Time', value: 'America/Denver' },
    { label: 'Central Time', value: 'America/Chicago' },
    { label: 'Eastern Time', value: 'America/New_York' },
    { label: 'UTC', value: 'UTC' },
    { label: 'London', value: 'Europe/London' },
    { label: 'Paris', value: 'Europe/Paris' },
    { label: 'Berlin', value: 'Europe/Berlin' },
    { label: 'Tokyo', value: 'Asia/Tokyo' },
    { label: 'Shanghai', value: 'Asia/Shanghai' },
    { label: 'Dubai', value: 'Asia/Dubai' },
    { label: 'Sydney', value: 'Australia/Sydney' },
    { label: 'Auckland', value: 'Pacific/Auckland' }
  ];

  try {
    // Get current timezone
    const profile = await firestoreService?.getUserProfile(authManager.getCurrentUser()!.uid);
    const currentTimezone = profile?.timezone || 'America/Los_Angeles';

    // Show quick pick
    const selected = await vscode.window.showQuickPick(
      commonTimezones.map(tz => ({
        label: tz.label,
        description: tz.value,
        picked: tz.value === currentTimezone
      })),
      {
        placeHolder: 'Select your timezone',
        title: `Current: ${currentTimezone}`
      }
    );

    if (!selected) {
      return;
    }

    // Update user profile
    await firestoreService?.saveUserProfile({
      uid: authManager.getCurrentUser()!.uid,
      timezone: selected.description!
    });

    vscode.window.showInformationMessage(`Timezone set to ${selected.label}`);
    outputChannel.appendLine(`Updated user timezone to: ${selected.description}`);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to set timezone: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * View session details
 */
async function viewSessionDetails(item: any): Promise<void> {
  if (!sessionDetailsView) {
    vscode.window.showErrorMessage('Session details view not available');
    return;
  }

  if (!item?.session) {
    vscode.window.showErrorMessage('Invalid session item');
    return;
  }

  try {
    sessionDetailsView.show(item.session);
    outputChannel.appendLine(`Showing details for session: ${item.session.sessionId}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show session details: ${error instanceof Error ? error.message : String(error)}`);
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
