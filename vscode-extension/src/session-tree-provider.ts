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
				this.subscribeToSessions(user.uid);
			} else {
				this.unsubscribeFromSessions();
				this.sessions = [];
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
				this.subscribeToSessions(currentUser.uid);
			} else {
				// Not signed in - show sign in message
				this.isLoading = false;
				this.isInitialized = true;
				this.refresh();
			}
		}, 100); // Small delay to let auth initialize
	}

	/**
	 * Subscribe to session updates
	 */
	private subscribeToSessions(uid: string): void {
		this.outputChannel.appendLine(`Subscribing to sessions for user: ${uid}`);
		
		this.isLoading = true;
		this.refresh();
		
		this.unsubscribe = this.firestoreService.subscribeToSessions(
			uid,
			(sessions) => {
				this.sessions = sessions;
				this.isLoading = false;
				this.isInitialized = true;
				this.refresh();
				this.outputChannel.appendLine(`Sessions updated: ${sessions.length} total`);
			},
			(error) => {
				this.outputChannel.appendLine(`Session subscription error: ${error.message}`);
				this.isLoading = false;
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
		// Check if auth is still being verified
		if (!this.authChecked || this.isLoading) {
			const item = new vscode.TreeItem('⏳ Loading...', vscode.TreeItemCollapsibleState.None);
			return Promise.resolve([item as any]);
		}
		
		// Check if user is signed in (only after auth is verified)
		if (!this.authManager.getCurrentUser()) {
			const item = new vscode.TreeItem('🔑 Sign in to view sessions', vscode.TreeItemCollapsibleState.None);
			return Promise.resolve([item as any]);
		}

		if (element) {
			// No children for session items
			return Promise.resolve([]);
		}

		// Root level - return all sessions sorted by date
		if (this.sessions.length === 0 && this.isInitialized) {
			const item = new vscode.TreeItem('📭 No sessions found', vscode.TreeItemCollapsibleState.None);
			return Promise.resolve([item as any]);
		}

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
		// Use the name field (which is mapped from title in Firestore)
		let label: string;
		
		// Check if name looks like a generic session path "sessions/XXXXXXXX"
		const isSessionPath = session.name && /^sessions\/\d+$/.test(session.name);
		
		if (isSessionPath || !session.name) {
			// Fallback to promptPath or session ID if name is missing or generic
			if (session.promptPath) {
				const pathParts = session.promptPath.split('/');
				const filename = pathParts[pathParts.length - 1];
				label = filename.replace(/\.md$/, '');
			} else {
				label = `Session ${session.sessionId.slice(0, 8)}`;
			}
		} else {
			// Use the descriptive title
			label = session.name;
		}
		
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

		// Make sessions clickable to open in Jules
		item.command = {
			command: 'vscode.open',
			title: 'Open Session in Jules',
			arguments: [vscode.Uri.parse(session.julesUrl)]
		};

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
	 * Get all sessions (for history/filtering)
	 */
	getAllSessions(): JulesSession[] {
		return this.sessions;
	}

	/**
	 * Filter sessions by status
	 */
	filterSessionsByStatus(status: SessionStatus): JulesSession[] {
		return this.sessions.filter(s => s.status === status);
	}

	/**
	 * Filter sessions by date range
	 */
	filterSessionsByDateRange(startDate: Date, endDate: Date): JulesSession[] {
		return this.sessions.filter(s => {
			if (!s.createdAt) {return false;}
			const sessionDate = new Date(s.createdAt.toMillis());
			return sessionDate >= startDate && sessionDate <= endDate;
		});
	}

	/**
	 * Search sessions by prompt path or name
	 */
	searchSessions(query: string): JulesSession[] {
		const lowerQuery = query.toLowerCase();
		return this.sessions.filter(s => 
			s.name?.toLowerCase().includes(lowerQuery) ||
			s.promptPath?.toLowerCase().includes(lowerQuery) ||
			s.branch?.toLowerCase().includes(lowerQuery)
		);
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
