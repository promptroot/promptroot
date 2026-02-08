/**
 * Jules Session Tree Provider
 * 
 * Displays session history in a tree view with real-time synchronization from Firestore
 */

import * as vscode from 'vscode';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesSession, SessionStatus } from './models';
import { Unsubscribe } from 'firebase/firestore';

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SessionTreeItem | undefined | null | void> = new vscode.EventEmitter<SessionTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<SessionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private sessions: JulesSession[] = [];
	private unsubscribe: Unsubscribe | null = null;

	constructor(
		private firestoreService: FirestoreService,
		private authManager: AuthManager,
		private outputChannel: vscode.OutputChannel
	) {
		// Subscribe to auth changes
		this.authManager.onAuthStateChanged((user) => {
			if (user) {
				this.subscribeToSessions(user.uid);
			} else {
				this.unsubscribeFromSessions();
				this.sessions = [];
				this.refresh();
			}
		});

		// Initial load if already signed in
		const currentUser = this.authManager.getCurrentUser();
		if (currentUser) {
			this.subscribeToSessions(currentUser.uid);
		}
	}

	/**
	 * Subscribe to session updates
	 */
	private subscribeToSessions(uid: string): void {
		this.outputChannel.appendLine(`Subscribing to sessions for user: ${uid}`);
		
		this.unsubscribe = this.firestoreService.subscribeToSessions(
			uid,
			(sessions) => {
				this.sessions = sessions;
				this.refresh();
				this.outputChannel.appendLine(`Sessions updated: ${sessions.length} total`);
			},
			(error) => {
				this.outputChannel.appendLine(`Session subscription error: ${error.message}`);
				vscode.window.showErrorMessage(`Session sync error: ${error.message}`);
			}
		);
	}

	/**
	 * Unsubscribe from session updates
	 */
	private unsubscribeFromSessions(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
			this.outputChannel.appendLine('Unsubscribed from sessions');
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
	getTreeItem(element: SessionTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * Get children for tree view
	 */
	getChildren(element?: SessionTreeItem): Thenable<SessionTreeItem[]> {
		if (!this.authManager.getCurrentUser()) {
			return Promise.resolve([]);
		}

		if (element) {
			// No children for session items
			return Promise.resolve([]);
		}

		// Root level - return all sessions sorted by date
		const sortedSessions = [...this.sessions].sort((a, b) => {
			const aTime = a.createdAt?.toMillis() || 0;
			const bTime = b.createdAt?.toMillis() || 0;
			return bTime - aTime; // Most recent first
		});

		return Promise.resolve(sortedSessions.map(session => this.createSessionTreeItem(session)));
	}

	/**
	 * Create tree item for a session
	 */
	private createSessionTreeItem(session: JulesSession): SessionTreeItem {
		const label = session.name || `Session ${session.sessionId.slice(0, 8)}`;
		const item = new SessionTreeItem(
			label,
			session,
			vscode.TreeItemCollapsibleState.None
		);

		// Set status icon
		item.iconPath = this.getStatusIcon(session.status);

		// Set description with date and status
		const date = session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleDateString() : '';
		item.description = `${date} • ${this.getStatusLabel(session.status)}`;

		// Set tooltip with details
		let tooltip = `Prompt: ${session.promptPath}\n`;
		tooltip += `Branch: ${session.branch}\n`;
		tooltip += `Status: ${this.getStatusLabel(session.status)}\n`;
		tooltip += `Created: ${session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleString() : 'Unknown'}`;
		
		if (session.pr) {
			tooltip += `\nPR: ${session.pr.title} (#${session.pr.number || 'N/A'})`;
		}
		
		if (session.failure) {
			tooltip += `\nFailure: ${session.failure.reason}`;
		}

		item.tooltip = tooltip;

		// Add context value for menu items
		item.contextValue = 'session';

		// Make PR sessions clickable
		if (session.pr?.url) {
			item.command = {
				command: 'promptroot.openPRInBrowser',
				title: 'Open PR',
				arguments: [session.pr.url]
			};
		}

		return item;
	}

	/**
	 * Get icon for session status
	 */
	private getStatusIcon(status: SessionStatus): vscode.ThemeIcon {
		switch (status) {
			case 'COMPLETED':
				return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
			case 'FAILED':
				return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
			case 'IN_PROGRESS':
				return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('progressBar.background'));
			case 'PLANNING':
				return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('editorWarning.foreground'));
			case 'QUEUED':
				return new vscode.ThemeIcon('clock');
			case 'PAUSED':
				return new vscode.ThemeIcon('debug-pause');
			default:
				return new vscode.ThemeIcon('circle-outline');
		}
	}

	/**
	 * Get human-readable status label
	 */
	private getStatusLabel(status: SessionStatus): string {
		switch (status) {
			case 'COMPLETED':
				return 'Completed';
			case 'FAILED':
				return 'Failed';
			case 'IN_PROGRESS':
				return 'In Progress';
			case 'PLANNING':
				return 'Planning';
			case 'QUEUED':
				return 'Queued';
			case 'PAUSED':
				return 'Paused';
			default:
				return status;
		}
	}

	/**
	 * Get session by ID
	 */
	getSessionById(sessionId: string): JulesSession | undefined {
		return this.sessions.find(s => s.sessionId === sessionId);
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.unsubscribeFromSessions();
	}
}

/**
 * Tree item for a session
 */
export class SessionTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly session: JulesSession,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
	}
}
