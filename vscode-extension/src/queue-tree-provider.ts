/**
 * Jules Queue Tree Provider
 * 
 * Displays queue items in a tree view with real-time synchronization from Firestore
 */

import * as vscode from 'vscode';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesQueueItem, isSingleQueueItem, isBatchQueueItem } from './models';
import { COMMANDS } from './constants';
import { Unsubscribe } from 'firebase/firestore';

export class QueueTreeProvider implements vscode.TreeDataProvider<QueueTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<QueueTreeItem | undefined | null | void> = new vscode.EventEmitter<QueueTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<QueueTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private queueItems: JulesQueueItem[] = [];
	private unsubscribe: Unsubscribe | null = null;
	private isLoading: boolean = true;  // Start in loading state
	private isInitialized: boolean = false;
	private authChecked: boolean = false;  // Track if auth status is verified

	constructor(
		private firestoreService: FirestoreService,
		private authManager: AuthManager,
		private outputChannel: vscode.OutputChannel
	) {
		// Start in loading state until auth is verified
		this.isLoading = true;
		this.authChecked = false;
		
		// Subscribe to auth changes
		this.authManager.onAuthStateChanged((user) => {
			this.authChecked = true;  // Auth status is now known
			if (user) {
				this.subscribeToQueue(user.uid);
			} else {
				this.unsubscribeFromQueue();
				this.queueItems = [];
				this.isLoading = false;
				this.isInitialized = true;
				this.refresh();
			}
		});

		// Check current auth state immediately
		setTimeout(() => {
			const currentUser = this.authManager.getCurrentUser();
			this.authChecked = true;
			if (currentUser) {
				this.subscribeToQueue(currentUser.uid);
			} else {
				// Not signed in - show sign in message
				this.isLoading = false;
				this.isInitialized = true;
				this.refresh();
			}
		}, 100); // Small delay to let auth initialize
	}

	/**
	 * Subscribe to queue updates
	 */
	private subscribeToQueue(uid: string): void {
		this.outputChannel.appendLine(`Subscribing to queue for user: ${uid}`);
		this.outputChannel.appendLine(`Collection path will be: julesQueues/${uid}/items`);
		
		// Set loading state
		this.isLoading = true;
		this.refresh();
		
		this.unsubscribe = this.firestoreService.subscribeToQueue(
			uid,
			(items) => {
				this.outputChannel.appendLine(`Firestore callback: Received ${items.length} items`);
				this.queueItems = items;
				this.isLoading = false;
				this.isInitialized = true;
				this.outputChannel.appendLine(`queueItems array updated: ${this.queueItems.length} items`);
				this.refresh();
				this.outputChannel.appendLine(`Queue updated: ${items.length} items`);
				// Log first few items for debugging
				if (items.length > 0) {
					this.outputChannel.appendLine(`Recent queue items:`);
					items.slice(0, 3).forEach((item, index) => {
						this.outputChannel.appendLine(`  ${index + 1}. ID: ${item.id}, Type: ${item.type}, Status: ${item.status}, Created: ${item.createdAt?.toDate?.()?.toISOString() || 'Unknown'}`);
					});
				}
			},
			(error) => {
				this.outputChannel.appendLine(`Queue subscription error: ${error.message}`);
				this.isLoading = false;
				vscode.window.showErrorMessage(`Queue sync error: ${error.message}`);
			},
			100 // Explicitly set limit to 100
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
		this.outputChannel.appendLine(`refresh() called - firing tree change event`);
		this._onDidChangeTreeData.fire();
		this.outputChannel.appendLine(`tree change event fired`);
		
		// Also fire with undefined to refresh root
		setTimeout(() => {
			this.outputChannel.appendLine(`Firing secondary refresh event`);
			this._onDidChangeTreeData.fire(undefined);
		}, 100);
	}

	/**
	 * Force refresh - reestablish subscription to get latest data
	 */
	forceRefresh(): void {
		this.outputChannel.appendLine('Force refreshing queue...');
		const currentUser = this.authManager.getCurrentUser();
		if (currentUser) {
			this.unsubscribeFromQueue();
			this.subscribeToQueue(currentUser.uid);
		} else {
			this.outputChannel.appendLine('No user signed in for force refresh');
		}
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
		this.outputChannel.appendLine(`getChildren() called - queueItems.length: ${this.queueItems.length}`);
		
		// Check if auth is still being verified
		if (!this.authChecked || this.isLoading) {
			this.outputChannel.appendLine('getChildren: Still loading or checking auth');
			return [new QueueTreeItem('⏳ Loading...', '', 'info')];
		}
		
		// Check if user is signed in (only after auth is verified)
		const user = this.authManager.getCurrentUser();
		if (!user) {
			this.outputChannel.appendLine('getChildren: No user signed in');
			const signInItem = new QueueTreeItem('🔑 Sign in to view queue', 'Click to sign in', 'info');
			signInItem.command = {
				command: COMMANDS.signIn,
				title: 'Sign In'
			};
			return [signInItem];
		}

		// If no element, return root items (queue items)
		if (!element) {
			this.outputChannel.appendLine(`getChildren: Root level - ${this.queueItems.length} items available`);
			if (this.queueItems.length === 0 && this.isInitialized) {
				this.outputChannel.appendLine('getChildren: Returning "No items in queue"');
				return [new QueueTreeItem('📭 No items in queue', '', 'info')];
			}

			this.outputChannel.appendLine(`getChildren: Creating tree items for ${this.queueItems.length} queue items`);
			const treeItems = this.queueItems.map(item => this.createQueueTreeItem(item));
			this.outputChannel.appendLine(`getChildren: Created ${treeItems.length} tree items`);
			return treeItems;
		}

		// If element is a batch item, return subtasks
		if (element.contextValue === 'subtasks' && element.queueItem) {
			const batchItem = element.queueItem;
			if (isBatchQueueItem(batchItem)) {
				return batchItem.remaining.map((subtask) => {
					const icon = this.getStatusIcon(subtask.status || 'pending');
					
					// Create descriptive label from subtask content
					let subtaskName = 'Subtask';
					if (subtask.fullContent) {
						const firstLine = subtask.fullContent.split('\n')[0].trim();
						subtaskName = firstLine.length > 60 ? firstLine.substring(0, 57) + '...' : firstLine;
					}
					
					const label = `${icon} ${subtaskName}`;
					const item = new QueueTreeItem(label, subtask.status || 'pending', 'subtask');
					item.tooltip = `Status: ${subtask.status || 'pending'}\nContent: ${subtask.fullContent}`;
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
		this.outputChannel.appendLine(`createQueueTreeItem: Creating item for ${queueItem.id}, type: ${queueItem.type}`);
		
		const icon = this.getStatusIcon(queueItem.status);
		
		let label: string;
		let description: string;
		let collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None;

		if (isSingleQueueItem(queueItem)) {
			this.outputChannel.appendLine(`createQueueTreeItem: Processing as single item`);
			this.outputChannel.appendLine(`createQueueTreeItem: queueItem.prompt = ${queueItem.prompt}`);
			this.outputChannel.appendLine(`createQueueTreeItem: queueItem.promptPath = ${queueItem.promptPath}`);
			
			// Single item - use prompt content or path
			let promptName = 'Untitled';
			
			if (queueItem.prompt && queueItem.prompt.trim()) {
				// Use first line of prompt, truncated
				const firstLine = queueItem.prompt.split('\n')[0].trim();
				promptName = firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
				this.outputChannel.appendLine(`createQueueTreeItem: Using prompt content: ${promptName}`);
			} else if (queueItem.promptPath) {
				// Fallback to filename
				promptName = queueItem.promptPath.split('/').pop() || 'Untitled';
				this.outputChannel.appendLine(`createQueueTreeItem: Using path filename: ${promptName}`);
			} else {
				this.outputChannel.appendLine(`createQueueTreeItem: No prompt or path available, using 'Untitled'`);
			}

			label = `${icon} ${promptName}`;
			description = queueItem.status;
		} else if (isBatchQueueItem(queueItem)) {
			this.outputChannel.appendLine(`createQueueTreeItem: Processing as batch item with ${queueItem.remaining.length} remaining`);
			this.outputChannel.appendLine(`createQueueTreeItem: batch queueItem.prompt = ${queueItem.prompt}`);
			
			// Batch item - create descriptive name
			let batchName = 'Batch';
			
			if (queueItem.prompt && queueItem.prompt.trim()) {
				// Use main prompt if available
				const firstLine = queueItem.prompt.split('\n')[0].trim();
				batchName = firstLine.length > 30 ? firstLine.substring(0, 27) + '...' : firstLine;
				this.outputChannel.appendLine(`createQueueTreeItem: Using batch prompt content: ${batchName}`);
			} else if (queueItem.remaining && queueItem.remaining.length > 0) {
				// Use first subtask content as batch name
				const firstSubtask = queueItem.remaining[0];
				if (firstSubtask.fullContent) {
					const firstLine = firstSubtask.fullContent.split('\n')[0].trim();
					batchName = firstLine.length > 30 ? firstLine.substring(0, 27) + '...' : firstLine;
					this.outputChannel.appendLine(`createQueueTreeItem: Using first subtask content: ${batchName}`);
				}
			} else {
				this.outputChannel.appendLine(`createQueueTreeItem: No prompt or subtask content available for batch, using 'Batch'`);
			}

			label = `${icon} ${batchName} (${queueItem.remaining.length} items)`;
			description = queueItem.status;
			collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		} else {
			// Fallback for unknown types - cast to any to access properties
			const unknownItem = queueItem as { type?: string; status?: string };
			this.outputChannel.appendLine(`createQueueTreeItem: Unknown item type: ${unknownItem.type}`);
			label = `${icon} Unknown Type (${unknownItem.type})`;
			description = unknownItem.status || 'unknown';
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
			tooltip += `\nPrompt: ${queueItem.promptPath || 'No path specified'}`;
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

		this.outputChannel.appendLine(`createQueueTreeItem: Successfully created tree item for ${queueItem.id} - Label: "${label}"`);
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
			'paused': '⏸️'
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
