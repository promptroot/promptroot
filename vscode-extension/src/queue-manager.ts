/**
 * Jules Queue Manager
 * 
 * Handles queue operations: add, delete, pause, resume, execute
 */

import * as vscode from 'vscode';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesQueueItem, QueueStatus, SingleQueueItem, BatchQueueItem, BatchSubtask } from './models';
import { Timestamp } from 'firebase/firestore';
import * as path from 'path';
import * as fs from 'fs';

export class QueueManager {
	constructor(
		private firestoreService: FirestoreService,
		private authManager: AuthManager,
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

		// Create subtasks
		const subtasks: BatchSubtask[] = [];
		for (const promptPath of promptPaths) {
			subtasks.push({
				promptPath,
				status: 'pending'
			});
		}

		const batchItem: Omit<BatchQueueItem, 'id'> = {
			type: 'batch',
			status: 'pending',
			sourceId: 'vscode-extension', // Source identifier
			branch,
			subtasks,
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
			// Update status to running
			await this.firestoreService.updateQueueItem(user.uid, itemId, {
				status: 'running',
				updatedAt: Timestamp.now()
			});

			// TODO: Integrate with Jules API execution
			// For now, simulate execution
			await this.simulateExecution(itemId);

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
	 * Simulate execution (placeholder for Jules API integration)
	 */
	private async simulateExecution(itemId: string): Promise<void> {
		// Simulate processing time
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		// For testing purposes
		this.outputChannel.appendLine(`[SIMULATED] Executed queue item: ${itemId}`);
	}

	/**
	 * Get suggested branch name
	 */
	getSuggestedBranch(): string {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		return `jules-${timestamp}`;
	}
}
