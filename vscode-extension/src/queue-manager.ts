/**
 * Jules Queue Manager
 * 
 * Handles queue operations: add, delete, pause, resume, execute
 */

import * as vscode from 'vscode';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesClient, JulesSource } from './jules-client';
import { JulesConfig } from './jules-config';
import { GitHubService } from './github-service';
import { JulesQueueItem, SingleQueueItem, BatchQueueItem, BatchSubtask, isSingleQueueItem, isBatchQueueItem } from './models';
import { Timestamp } from 'firebase/firestore';
import * as path from 'path';
import * as fs from 'fs';

export class QueueManager {
	constructor(
		private firestoreService: FirestoreService,
		private authManager: AuthManager,
		private julesClient: JulesClient,
		private julesConfig: JulesConfig,
		private githubService: GitHubService,
		private outputChannel: vscode.OutputChannel
	) {}

	/**
	 * Add single prompt to queue
	 */
	async addToQueue(promptPath: string, branch: string): Promise<string> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Read prompt content
		const fullPath = this.resolvePromptPath(promptPath);
		const content = await this.readPromptFile(fullPath);

		const queueItem: Omit<SingleQueueItem, 'id'> = {
			type: 'single',
			status: 'pending',
			promptPath,
			prompt: content,
			sourceId: 'vscode-extension', // Source identifier
			branch,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now()
		};

		const id = await this.firestoreService.addQueueItem(user.uid, queueItem);
		this.outputChannel.appendLine(`Added to queue: ${promptPath} (${id})`);
		
		return id;
	}

	/**
	 * Add multiple prompts to queue as batch
	 */
	async addBatchToQueue(promptPaths: string[], branch: string): Promise<string> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Create remaining items by loading file content
		const remaining: BatchSubtask[] = [];
		for (const promptPath of promptPaths) {
			try {
				// Load the file content
				const uri = vscode.Uri.file(promptPath);
				const content = await vscode.workspace.fs.readFile(uri);
				const fullContent = Buffer.from(content).toString('utf8');
				
				remaining.push({
					fullContent,
					status: 'pending'
				});
			} catch (error) {
				this.outputChannel.appendLine(`Warning: Could not read file ${promptPath}: ${error}`);
				// Add with path as content for debugging
				remaining.push({
					fullContent: `File not found: ${promptPath}`,
					status: 'failed',
					error: `Could not read file: ${error instanceof Error ? error.message : String(error)}`
				});
			}
		}

		const batchItem: Omit<BatchQueueItem, 'id'> = {
			type: 'subtasks',
			status: 'pending',
			prompt: `Batch of ${remaining.length} prompts from VS Code`, // Added basic prompt description
			sourceId: 'vscode-extension', // Source identifier
			branch,
			remaining,
			totalCount: remaining.length,
			completedCount: 0,
			failedCount: 0,
			createdAt: Timestamp.now(),
			updatedAt: Timestamp.now()
		};

		const id = await this.firestoreService.addQueueItem(user.uid, batchItem);
		this.outputChannel.appendLine(`Added batch to queue: ${promptPaths.length} items (${id})`);
		
		return id;
	}

	/**
	 * Delete queue item
	 */
	async deleteQueueItem(itemId: string): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		await this.firestoreService.deleteQueueItem(user.uid, itemId);
		this.outputChannel.appendLine(`Deleted queue item: ${itemId}`);
	}

	/**
	 * Pause queue item
	 */
	async pauseQueueItem(itemId: string): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		await this.firestoreService.updateQueueItem(user.uid, itemId, {
			status: 'paused',
			updatedAt: Timestamp.now()
		});
		this.outputChannel.appendLine(`Paused queue item: ${itemId}`);
	}

	/**
	 * Resume queue item
	 */
	async resumeQueueItem(itemId: string): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		await this.firestoreService.updateQueueItem(user.uid, itemId, {
			status: 'pending',
			updatedAt: Timestamp.now()
		});
		this.outputChannel.appendLine(`Resumed queue item: ${itemId}`);
	}

	/**
	 * Run queue item (execute with Jules API)
	 */
	async runQueueItem(itemId: string): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		this.outputChannel.appendLine(`Running queue item: ${itemId}`);

		try {
			// Get queue item details
			const queueItems = await this.firestoreService.getQueueItems(user.uid);
			const queueItem = queueItems.find(item => item.id === itemId);
			if (!queueItem) {
				throw new Error(`Queue item not found: ${itemId}`);
			}

			// Update status to running
			await this.firestoreService.updateQueueItem(user.uid, itemId, {
				status: 'running',
				updatedAt: Timestamp.now()
			});

			// Execute with Jules API
			await this.executeWithJules(queueItem);

			// Update status to completed
			await this.firestoreService.updateQueueItem(user.uid, itemId, {
				status: 'completed',
				updatedAt: Timestamp.now()
			});

			this.outputChannel.appendLine(`Completed queue item: ${itemId}`);
			vscode.window.showInformationMessage(`Queue item completed: ${itemId}`);

		} catch (error) {
			// Update status to failed
			await this.firestoreService.updateQueueItem(user.uid, itemId, {
				status: 'failed',
				lastError: {
					message: error instanceof Error ? error.message : String(error),
					timestamp: Timestamp.now()
				},
				updatedAt: Timestamp.now()
			});

			this.outputChannel.appendLine(`Failed queue item: ${itemId} - ${error}`);
			vscode.window.showErrorMessage(`Queue item failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Schedule queue item for future execution
	 */
	async scheduleQueueItem(itemId: string, scheduledAt: Date): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		await this.firestoreService.updateQueueItem(user.uid, itemId, {
			status: 'scheduled',
			scheduledAt: Timestamp.fromDate(scheduledAt),
			updatedAt: Timestamp.now()
		});

		this.outputChannel.appendLine(`Scheduled queue item: ${itemId} for ${scheduledAt.toLocaleString()}`);
		vscode.window.showInformationMessage(`Queue item scheduled for ${scheduledAt.toLocaleString()}`);
	}

	/**
	 * Resolve prompt path to full file path
	 */
	private resolvePromptPath(promptPath: string): string {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error('No workspace folder open');
		}

		// If path is already absolute, return it
		if (path.isAbsolute(promptPath)) {
			return promptPath;
		}

		// Otherwise, resolve relative to workspace
		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		return path.join(workspaceRoot, promptPath);
	}

	/**
	 * Read prompt file content
	 */
	private async readPromptFile(filePath: string): Promise<string> {
		try {
			const content = await fs.promises.readFile(filePath, 'utf8');
			return content;
		} catch (error) {
			throw new Error(`Failed to read prompt file: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Execute queue item with Jules API
	 */
	private async executeWithJules(queueItem: JulesQueueItem): Promise<void> {
		// Get Jules API key
		const apiKey = await this.julesConfig.getApiKey();
		if (!apiKey) {
			throw new Error('Jules API key not configured. Please configure it first.');
		}

		// Get ALL Jules sources (with pagination support)
		this.outputChannel.appendLine('Fetching all available Jules repositories...');
		const allSources = await this.julesClient.listAllSources(apiKey);
		if (!allSources || allSources.length === 0) {
			throw new Error('No Jules sources available. Please connect a repository to Jules first.');
		}

		this.outputChannel.appendLine(`Found ${allSources.length} available repositories`);

		// Let user select repository
		const source = await this.selectJulesSource(allSources);
		if (!source) {
			return; // User cancelled
		}

		this.outputChannel.appendLine(`Selected Jules source: ${source.displayName || source.name}`);

		// Let user select or confirm branch
		const branch = await this.selectBranch(source, queueItem.branch);
		if (!branch) {
			return; // User cancelled
		}

		this.outputChannel.appendLine(`Selected branch: ${branch}`);

		if (isSingleQueueItem(queueItem)) {
			// Handle single queue item
			const prompt = queueItem.prompt;
			const title = `VS Code Queue Item - ${new Date().toISOString()}`;

			const session = await this.julesClient.createSession(
				apiKey,
				prompt,
				source.name,
				branch,
				title,
				false, // autoCreatePR - could be made configurable
				false  // requirePlanApproval - could be made configurable
			);

			this.outputChannel.appendLine(`Created Jules session: ${session.name}`);

		} else if (isBatchQueueItem(queueItem)) {
			// Handle batch queue item - create separate sessions for each subtask
			if (!queueItem.remaining || queueItem.remaining.length === 0) {
				throw new Error('Batch queue item has no remaining subtasks');
			}

			for (let i = 0; i < queueItem.remaining.length; i++) {
				const subtask = queueItem.remaining[i];
				const title = `VS Code Batch Item ${i + 1}/${queueItem.remaining.length} - ${new Date().toISOString()}`;

				const session = await this.julesClient.createSession(
					apiKey,
					subtask.fullContent,
					source.name,
					queueItem.branch,
					title,
					false, // autoCreatePR
					false  // requirePlanApproval
				);

				this.outputChannel.appendLine(`Created Jules session for subtask ${i + 1}: ${session.name}`);

				// Small delay between requests to avoid rate limiting
				if (i < queueItem.remaining.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}
		}
	}

	/**
	 * Run next pending queue item
	 */
	async runNextPending(queueItems: JulesQueueItem[]): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Find first pending item
		const pendingItem = queueItems.find(item => item.status === 'pending');
		
		if (!pendingItem) {
			vscode.window.showInformationMessage('No pending items in queue');
			return;
		}

		this.outputChannel.appendLine(`Running next pending item: ${pendingItem.id}`);
		await this.runQueueItem(pendingItem.id);
	}

	/**
	 * Run all pending queue items
	 */
	async runAllPending(queueItems: JulesQueueItem[]): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Get all pending items
		const pendingItems = queueItems.filter(item => item.status === 'pending');
		
		if (pendingItems.length === 0) {
			vscode.window.showInformationMessage('No pending items in queue');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Run ${pendingItems.length} pending queue item(s)?`,
			{ modal: true },
			'Run All'
		);

		if (confirm !== 'Run All') {
			return;
		}

		this.outputChannel.appendLine(`Running ${pendingItems.length} pending items`);

		// Run items sequentially with progress
		let completed = 0;
		let failed = 0;

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Running queue items...',
			cancellable: false
		}, async (progress) => {
			for (let i = 0; i < pendingItems.length; i++) {
				const item = pendingItems[i];
				progress.report({
					message: `Item ${i + 1}/${pendingItems.length}: ${item.type === 'single' ? (item as SingleQueueItem).promptPath : 'Batch'}`,
					increment: (100 / pendingItems.length)
				});

				try {
					await this.runQueueItem(item.id);
					completed++;
				} catch (error) {
					this.outputChannel.appendLine(`Failed to run item ${item.id}: ${error}`);
					failed++;
				}
			}
		});

		vscode.window.showInformationMessage(
			`Queue execution complete: ${completed} succeeded, ${failed} failed`
		);
	}

	/**
	 * Clear completed queue items
	 */
	async clearCompleted(queueItems: JulesQueueItem[]): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Get all completed items
		const completedItems = queueItems.filter(item => item.status === 'completed');
		
		if (completedItems.length === 0) {
			vscode.window.showInformationMessage('No completed items in queue');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Delete ${completedItems.length} completed queue item(s)?`,
			{ modal: true },
			'Delete All'
		);

		if (confirm !== 'Delete All') {
			return;
		}

		this.outputChannel.appendLine(`Clearing ${completedItems.length} completed items`);

		// Delete all completed items
		for (const item of completedItems) {
			try {
				await this.firestoreService.deleteQueueItem(user.uid, item.id);
			} catch (error) {
				this.outputChannel.appendLine(`Failed to delete item ${item.id}: ${error}`);
			}
		}

		vscode.window.showInformationMessage(`Cleared ${completedItems.length} completed item(s)`);
	}

	/**
	 * Clear failed queue items
	 */
	async clearFailed(queueItems: JulesQueueItem[]): Promise<void> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			throw new Error('User not signed in');
		}

		// Get all failed items
		const failedItems = queueItems.filter(item => item.status === 'failed');
		
		if (failedItems.length === 0) {
			vscode.window.showInformationMessage('No failed items in queue');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Delete ${failedItems.length} failed queue item(s)?`,
			{ modal: true },
			'Delete All'
		);

		if (confirm !== 'Delete All') {
			return;
		}

		this.outputChannel.appendLine(`Clearing ${failedItems.length} failed items`);

		// Delete all failed items
		for (const item of failedItems) {
			try {
				await this.firestoreService.deleteQueueItem(user.uid, item.id);
			} catch (error) {
				this.outputChannel.appendLine(`Failed to delete item ${item.id}: ${error}`);
			}
		}

		vscode.window.showInformationMessage(`Cleared ${failedItems.length} failed item(s)`);
	}

	/**
	 * Let user select a Jules source (repository)
	 */
	private async selectJulesSource(sources: JulesSource[]): Promise<JulesSource | undefined> {
		if (sources.length === 1) {
			// If only one source, ask for confirmation
			const confirm = await vscode.window.showQuickPick(['Yes', 'Cancel'], {
				placeHolder: `Send to repository: ${sources[0].displayName || sources[0].name}?`
			});
			return confirm === 'Yes' ? sources[0] : undefined;
		}

		// Multiple sources - let user pick
		const items = sources.map(source => ({
			label: source.displayName || source.name,
			description: source.name,
			source
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select repository to send task to',
			matchOnDescription: true
		});

		return selected?.source;
	}

	/**
	 * Let user select or confirm branch for the selected repository
	 */
	private async selectBranch(source: JulesSource, suggestedBranch: string): Promise<string | undefined> {
		let defaultBranch = suggestedBranch;
		let availableBranches: string[] = [];

		// Try to detect repository info and get branches
		try {
			// Parse Jules source name: sources/github/owner/repo
			const match = source.name.match(/sources\/github\/([^/]+)\/([^/]+)/);
			if (match && this.githubService) {
				const [, owner, repo] = match;
				this.outputChannel.appendLine(`Fetching branches for ${owner}/${repo} from Jules source: ${source.name}`);

				// Get repository info to find default branch
				const repoInfo = await this.githubService.getRepository(owner, repo);
				if (repoInfo?.default_branch) {
					defaultBranch = repoInfo.default_branch;
					this.outputChannel.appendLine(`Repository default branch: ${defaultBranch}`);
				}

				// Get available branches
				const branches = await this.githubService.listBranches(owner, repo);
				availableBranches = branches.map(b => b.name);
				this.outputChannel.appendLine(`Found ${availableBranches.length} branches`);
			}
		} catch (error) {
			this.outputChannel.appendLine(`Failed to fetch branch info: ${error}`);
		}

		// Create branch selection items
		const branchItems: vscode.QuickPickItem[] = [];

		// Always include the default/suggested branch first
		branchItems.push({
			label: defaultBranch,
			description: '(default)',
			picked: true
		});

		// Add other available branches (excluding the default to avoid duplicates)
		for (const branch of availableBranches) {
			if (branch !== defaultBranch) {
				branchItems.push({
					label: branch,
					description: ''
				});
			}
		}

		// Add option to enter custom branch
		branchItems.push({
			label: '$(edit) Enter custom branch name...',
			description: 'Type a custom branch name',
		});

		const selected = await vscode.window.showQuickPick(branchItems, {
			placeHolder: `Select branch for ${source.displayName || source.name}`,
			matchOnDescription: true
		});

		if (!selected) {
			return undefined; // User cancelled
		}

		// Handle custom branch entry
		if (selected.label.startsWith('$(edit)')) {
			return await vscode.window.showInputBox({
				prompt: 'Enter custom branch name',
				value: defaultBranch,
				placeHolder: 'branch-name'
			});
		}

		return selected.label;
	}

	/**
	 * Get suggested branch name
	 */
	getSuggestedBranch(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		return `jules-${timestamp}`;
	}
}
