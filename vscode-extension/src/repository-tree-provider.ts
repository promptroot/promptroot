import * as vscode from 'vscode';
import { GitHubService, GitHubRepository } from './github-service';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { COMMANDS } from './constants';

/**
 * Repository tree item types
 */
export enum RepositoryItemType {
	LOADING = 'loading',
	FAVORITES_GROUP = 'favoritesGroup',
	ALL_REPOS_GROUP = 'allReposGroup',
	REPOSITORY = 'repository'
}

/**
 * Tree item for repository view
 */
export class RepositoryTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly type: RepositoryItemType,
		public readonly repository?: GitHubRepository,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
		public readonly contextValue?: string
	) {
		super(label, collapsibleState);

		// Set icons and context values
		if (type === RepositoryItemType.REPOSITORY && repository) {
			this.iconPath = new vscode.ThemeIcon('repo');
			this.description = repository.private ? 'Private' : 'Public';
			this.tooltip = this.createTooltip(repository);
			// Use passed contextValue if provided, otherwise fall back to default
			if (!this.contextValue) {
				this.contextValue = repository.private ? 'repository-private' : 'repository-public';
			}
			
			// Make repositories clickable
			this.command = {
				command: 'promptroot.openRepository',
				title: 'Open Repository',
				arguments: [repository]
			};
		} else if (type === RepositoryItemType.FAVORITES_GROUP) {
			this.iconPath = new vscode.ThemeIcon('star-full');
			this.contextValue = 'favoritesGroup';
		} else if (type === RepositoryItemType.ALL_REPOS_GROUP) {
			this.iconPath = new vscode.ThemeIcon('repo');
			this.contextValue = 'allReposGroup';
		}
	}

	private createTooltip(repo: GitHubRepository): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		tooltip.appendMarkdown(`**${repo.full_name}**\n\n`);
		
		if (repo.description) {
			tooltip.appendMarkdown(`${repo.description}\n\n`);
		}
		
		tooltip.appendMarkdown(`- **Default Branch:** ${repo.default_branch}\n`);
		tooltip.appendMarkdown(`- **Language:** ${repo.language || 'N/A'}\n`);
		tooltip.appendMarkdown(`- **Stars:** ${repo.stargazers_count}\n`);
		tooltip.appendMarkdown(`- **Forks:** ${repo.forks_count}\n`);
		tooltip.appendMarkdown(`- **Updated:** ${new Date(repo.updated_at).toLocaleDateString()}\n`);
		
		return tooltip;
	}
}

/**
 * Tree data provider for GitHub repositories
 */
export class RepositoryTreeProvider implements vscode.TreeDataProvider<RepositoryTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<RepositoryTreeItem | undefined | null | void> = new vscode.EventEmitter<RepositoryTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<RepositoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private githubService: GitHubService;
	private firestoreService: FirestoreService;
	private favoriteRepos: Set<string> = new Set();
	private isLoading = true;  // Start in loading state
	private authChecked = false;  // Track if auth status is verified

	constructor(
		private readonly authManager: AuthManager,
		private readonly outputChannel: vscode.OutputChannel
	) {
		this.githubService = new GitHubService(authManager, outputChannel);
		this.firestoreService = new FirestoreService(outputChannel);
		
		// Start in loading state until auth is verified
		this.isLoading = true;
		this.authChecked = false;
		
		// Load favorites from Firestore
		this.loadFavorites();
		
		// Listen for auth state changes and refresh tree
		this.authManager.onAuthStateChanged((user) => {
			this.outputChannel.appendLine(`Repository tree: Auth state changed, user=${user?.email || 'none'}`);
			this.authChecked = true;
			this.isLoading = false;
			this.refresh();
			if (user) {
				this.loadFavorites();
			}
		});
		
		// Check current auth state immediately  
		setTimeout(() => {
			this.authChecked = true;
			this.isLoading = false;
			this.refresh();
		}, 100); // Small delay to let auth initialize
	}

	/**
	 * Load favorite repositories from Firestore
	 */
	private async loadFavorites(): Promise<void> {
		try {
			const user = this.authManager.getCurrentUser();
			if (!user) {
				this.outputChannel.appendLine('Repository tree: Cannot load favorites - no user');
				return;
			}
			
			this.outputChannel.appendLine(`Repository tree: Loading favorites for user ${user.uid}`);
			const profile = await this.firestoreService.getUserProfile(user.uid);
			
			if (profile) {
				this.outputChannel.appendLine(`Repository tree: Profile loaded, favoriteRepos=${JSON.stringify(profile.favoriteRepos)}`);
			if (profile.favoriteRepos && Array.isArray(profile.favoriteRepos)) {
				// Extract repo names from web app format: {branch, id, name}
				const repoNames = profile.favoriteRepos.map(repo => {
					if (typeof repo === 'string') {
						// Handle legacy format
						return repo;
					} else if (repo && typeof repo === 'object' && 'name' in repo) {
						// Handle web app format
						return repo.name;
					}
					return null;
				}).filter(name => name !== null);
				this.favoriteRepos = new Set(repoNames as string[]);
				this.outputChannel.appendLine(`Repository tree: Loaded ${this.favoriteRepos.size} favorite repositories: ${Array.from(this.favoriteRepos).join(', ')}`);
				}
			} else {
				this.outputChannel.appendLine('Repository tree: No profile found');
			}
			
			// Refresh tree to show the loaded favorites
			this.refresh();
		} catch (error) {
			this.outputChannel.appendLine(`Repository tree: Failed to load favorite repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Save favorite repositories to Firestore
	 */
	private async saveFavorites(): Promise<void> {
		try {
			const user = this.authManager.getCurrentUser();
			if (!user) {
				throw new Error('User not signed in');
			}
			
			// Get current profile to preserve existing favorites format
			const currentProfile = await this.firestoreService.getUserProfile(user.uid);
			let favoriteRepos = currentProfile?.favoriteRepos || [];
			
			// Convert favorites to web app format while preserving existing entries
			const repoNames = Array.from(this.favoriteRepos);
			const updatedFavorites = [];
			
			// First add existing favorites that are still in the current set
			for (const existing of favoriteRepos) {
				const existingName = typeof existing === 'string' ? existing : existing.name;
				if (repoNames.includes(existingName)) {
					updatedFavorites.push(existing);
				}
			}
			
			// Then add new favorites in web app format
			for (const repoName of repoNames) {
				const existingEntry = favoriteRepos.find(fav => {
					const name = typeof fav === 'string' ? fav : fav.name;
					return name === repoName;
				});
				
				if (!existingEntry) {
					// Create new entry in web app format
					updatedFavorites.push({
						branch: 'main', // Default to main branch
						id: `sources/github/${repoName}`,
						name: repoName
					});
				}
			}
			
			await this.firestoreService.saveUserProfile({
				uid: user.uid,
				favoriteRepos: updatedFavorites
			});
		} catch (error) {
			this.outputChannel.appendLine(`Failed to save favorite repositories: ${error instanceof Error ? (error.stack || error.message) : String(error)}`);
			throw error;
		}
	}

	/**
	 * Add repository to favorites
	 */
	public async addFavorite(repoFullName: string): Promise<void> {
		this.favoriteRepos.add(repoFullName);
		await this.saveFavorites();
		this.refresh();
	}

	/**
	 * Remove repository from favorites
	 */
	public async removeFavorite(repoFullName: string): Promise<void> {
		this.favoriteRepos.delete(repoFullName);
		await this.saveFavorites();
		this.refresh();
	}

	/**
	 * Check if repository is favorited
	 */
	public isFavorite(repoFullName: string): boolean {
		return this.favoriteRepos.has(repoFullName);
	}

	/**
	 * Refresh the tree view
	 */
	public refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: RepositoryTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: RepositoryTreeItem): Promise<RepositoryTreeItem[]> {
		// Check if auth is still being verified
		if (!this.authChecked) {
			return [
				new RepositoryTreeItem(
					'⏳ Loading...',
					RepositoryItemType.LOADING,
					undefined,
					vscode.TreeItemCollapsibleState.None
				)
			];
		}
		
		// Check authentication (only after auth is verified)
		if (!this.authManager.isSignedIn()) {
			const signInItem = new RepositoryTreeItem(
				'🔑 Sign in to view repositories',
				RepositoryItemType.LOADING,
				undefined,
				vscode.TreeItemCollapsibleState.None
			);
			signInItem.description = 'Click to sign in';
			signInItem.command = {
				command: COMMANDS.signIn,
				title: 'Sign In'
			};
			return [
				signInItem
			];
		}

		// Root level: show Favorites and All Repositories groups
		if (!element) {
			return [
				new RepositoryTreeItem(
					'Favorites',
					RepositoryItemType.FAVORITES_GROUP,
					undefined,
					vscode.TreeItemCollapsibleState.Expanded
				),
				new RepositoryTreeItem(
					'All Repositories',
					RepositoryItemType.ALL_REPOS_GROUP,
					undefined,
					vscode.TreeItemCollapsibleState.Collapsed
				)
			];
		}

		// Show loading indicator
		if (this.isLoading) {
			return [
				new RepositoryTreeItem(
					'Loading repositories...',
					RepositoryItemType.LOADING,
					undefined,
					vscode.TreeItemCollapsibleState.None
				)
			];
		}

		// Load repositories
		try {
			this.isLoading = true;
			// Don't call refresh here - it creates an infinite loop!

			const repos = await this.githubService.listRepositories();
			this.isLoading = false;

			if (!repos || repos.length === 0) {
				return [
					new RepositoryTreeItem(
						'No repositories found',
						RepositoryItemType.LOADING,
						undefined,
						vscode.TreeItemCollapsibleState.None
					)
				];
			}

			// Filter based on group
			let filteredRepos: GitHubRepository[] = [];
			if (element.type === RepositoryItemType.FAVORITES_GROUP) {
				filteredRepos = repos.filter(repo => this.favoriteRepos.has(repo.full_name));
				
				if (filteredRepos.length === 0) {
					return [
						new RepositoryTreeItem(
							'No favorite repositories',
							RepositoryItemType.LOADING,
							undefined,
							vscode.TreeItemCollapsibleState.None
						)
					];
				}
			} else if (element.type === RepositoryItemType.ALL_REPOS_GROUP) {
				filteredRepos = repos;
			}

			// Sort by updated date (most recent first)
			filteredRepos.sort((a, b) => {
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			});

			// Create tree items
			return filteredRepos.map(repo => {
				const isFavorite = this.favoriteRepos.has(repo.full_name);
				const visibility = repo.private ? 'private' : 'public';
				const contextValue = isFavorite ? `repository-favorite-${visibility}` : `repository-normal-${visibility}`;
				
				const item = new RepositoryTreeItem(
					repo.name,
					RepositoryItemType.REPOSITORY,
					repo,
					vscode.TreeItemCollapsibleState.None,
					contextValue
				);
				
				// Add star icon for favorites
				if (isFavorite) {
					item.iconPath = new vscode.ThemeIcon('star-full');
				}
				
				return item;
			});

		} catch (error) {
			this.isLoading = false;
			this.outputChannel.appendLine(`Failed to load repositories: ${error instanceof Error ? (error.stack || error.message) : String(error)}`);
			
			return [
				new RepositoryTreeItem(
					'Failed to load repositories',
					RepositoryItemType.LOADING,
					undefined,
					vscode.TreeItemCollapsibleState.None
				)
			];
		}
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		// Clean up any resources if needed
	}
}
