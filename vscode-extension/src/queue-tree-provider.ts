/**
 * Jules Queue Tree Provider
 * 
 * Displays queue items in a tree view with real-time synchronization from Firestore
 */

import * as vscode from 'vscode';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesQueueItem, isSingleQueueItem, isBatchQueueItem } from './models';
import { Unsubscribe } from 'firebase/firestore';

export class QueueTreeProvider implements vscode.TreeDataProvider<QueueTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<QueueTreeItem | undefined | null | void> = new vscode.EventEmitter<QueueTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<QueueTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private queueItems: JulesQueueItem[] = [];
	private unsubscribe: Unsubscribe | null = null;

	constructor(
		private firestoreService: FirestoreService,
		private authManager: AuthManager,
		private outputChannel: vscode.OutputChannel
	) {
		// Subscribe to auth changes
		this.authManager.onAuthStateChanged((user) => {
			if (user) {
				this.subscribeToQueue(user.uid);
			} else {
				this.unsubscribeFromQueue();
				this.queueItems = [];
				this.refresh();
			}
		});

		// Initial load if already signed in
		const currentUser = this.authManager.getCurrentUser();
		if (currentUser) {
			this.subscribeToQueue(currentUser.uid);
		}
	}

	/**
	 * Subscribe to queue updates
	 */
	private subscribeToQueue(uid: string): void {
		this.outputChannel.appendLine(`Subscribing to queue for user: ${uid}`);
		
		this.unsubscribe = this.firestoreService.subscribeToQueue(
			uid,
			(items) => {
				this.queueItems = items;
				this.refresh();
				this.outputChannel.appendLine(`Queue updated: ${items.length} items`);
			},
			(error) => {
				this.outputChannel.appendLine(`Queue subscription error: ${error.message}`);
				vscode.window.showErrorMessage(`Queue sync error: ${error.message}`);
			}
		);
	}

	/**
	 * Unsubscribe from queue updates
	 */
	private unsubscribeFromQueue(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
			this.outputChannel.appendLine('Unsubscribed from queue');
		}
	}

	/**
	 * Refresh tree view
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Get tree item
	 */
	getTreeItem(element: QueueTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * Get children (queue items)
	 */
	async getChildren(element?: QueueTreeItem): Promise<QueueTreeItem[]> {
		// Check if user is signed in
		const user = this.authManager.getCurrentUser();
		if (!user) {
			return [new QueueTreeItem('Sign in to view queue', '', 'info')];
		}

		// If no element, return root items (queue items)
		if (!element) {
			if (this.queueItems.length === 0) {
				return [new QueueTreeItem('No items in queue', '', 'info')];
			}

			return this.queueItems.map(item => this.createQueueTreeItem(item));
		}

		// If element is a batch item, return subtasks
		if (element.contextValue === 'batch' && element.queueItem) {
			const batchItem = element.queueItem;
			if (isBatchQueueItem(batchItem)) {
				return batchItem.subtasks.map((subtask, index) => {
					const icon = this.getStatusIcon(subtask.status);
					const label = `${icon} ${subtask.promptPath}`;
					const item = new QueueTreeItem(label, subtask.status, 'subtask');
					item.tooltip = `Status: ${subtask.status}\nPath: ${subtask.promptPath}`;
					if (subtask.sessionId) {
						item.tooltip += `\nSession: ${subtask.sessionId}`;
					}
					if (subtask.error) {
						item.tooltip += `\nError: ${subtask.error}`;
					}
					return item;
				});
			}
		}

		return [];
	}

	/**
	 * Create tree item from queue item
	 */
	private createQueueTreeItem(queueItem: JulesQueueItem): QueueTreeItem {
		const icon = this.getStatusIcon(queueItem.status);
		
		let label: string;
		let description: string;
		let collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;

		if (isSingleQueueItem(queueItem)) {
			// Single item
			const promptName = queueItem.promptPath.split('/').pop() || 'Untitled';
			label = `${icon} ${promptName}`;
			
			// Show schedule time in description if scheduled
			if (queueItem.status === 'scheduled' && queueItem.scheduledAt) {
				const scheduleDate = queueItem.scheduledAt.toDate();
				const now = new Date();
				const isOverdue = scheduleDate < now;
				
				// Format date/time
				const dateStr = scheduleDate.toLocaleDateString(undefined, { 
					month: 'short', 
					day: 'numeric' 
				});
				const timeStr = scheduleDate.toLocaleTimeString(undefined, { 
					hour: '2-digit', 
					minute: '2-digit' 
				});
				
				description = isOverdue 
					? `⚠️ Overdue: ${dateStr} ${timeStr}`
					: `⏰ ${dateStr} ${timeStr}`;
			} else {
				description = queueItem.status;
			}
		} else {
			// Batch item
			label = `${icon} Batch (${queueItem.subtasks.length} items)`;
			description = queueItem.status;
			collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		}

		const item = new QueueTreeItem(
			label,
			description,
			queueItem.type,
			collapsibleState
		);

		item.queueItem = queueItem;
		item.id = queueItem.id;

		// Build tooltip
		let tooltip = `Status: ${queueItem.status}\n`;
		tooltip += `Type: ${queueItem.type}\n`;
		tooltip += `Branch: ${queueItem.branch}\n`;
		tooltip += `Created: ${queueItem.createdAt.toDate().toLocaleString()}`;

		if (isSingleQueueItem(queueItem)) {
			tooltip += `\nPrompt: ${queueItem.promptPath}`;
			if (queueItem.scheduledAt) {
				tooltip += `\nScheduled: ${queueItem.scheduledAt.toDate().toLocaleString()}`;
				if (queueItem.scheduledTimeZone) {
					tooltip += ` (${queueItem.scheduledTimeZone})`;
				}
			}
		}

		if (queueItem.lastError) {
			tooltip += `\n\nError: ${queueItem.lastError.message}`;
		}

		item.tooltip = tooltip;

		// Set icon color based on status
		if (queueItem.status === 'failed') {
			item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
		} else if (queueItem.status === 'completed') {
			item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
		} else if (queueItem.status === 'running') {
			item.iconPath = new vscode.ThemeIcon('loading~spin');
		} else if (queueItem.status === 'scheduled') {
			// Add watch icon for scheduled items
			item.iconPath = new vscode.ThemeIcon('watch', new vscode.ThemeColor('charts.blue'));
		}

		return item;
	}

	/**
	 * Get status icon emoji
	 */
	private getStatusIcon(status: string): string {
		const icons: Record<string, string> = {
			'pending': '📝',
			'running': '▶️',
			'completed': '✅',
			'failed': '❌',
			'paused': '⏸️',
			'scheduled': '📅'
		};
		return icons[status] || '❓';
	}

	/**
	 * Get queue items (for use by commands)
	 */
	getQueueItems(): JulesQueueItem[] {
		return this.queueItems;
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.unsubscribeFromQueue();
		this._onDidChangeTreeData.dispose();
	}
}

/**
 * Tree item for queue view
 */
export class QueueTreeItem extends vscode.TreeItem {
	queueItem?: JulesQueueItem;

	constructor(
		public readonly label: string,
		public readonly description: string,
		public readonly contextValue: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		super(label, collapsibleState);
		this.description = description;
		this.contextValue = contextValue;
	}
}
