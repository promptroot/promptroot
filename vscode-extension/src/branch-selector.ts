/**
 * Branch Selector
 * 
 * Handles branch selection UI and management
 */

import * as vscode from 'vscode';
import { GitHubService, GitHubBranch, GitHubRepository } from './github-service';
import { AuthManager } from './auth-manager';
import { FirestoreService } from './firestore-service';

/**
 * Repository branch preferences
 */
interface RepoBranchPreferences {
	repoFullName: string;
	defaultBranch?: string;
	recentBranches: string[];
	lastUpdated: number;
}

/**
 * Branch selector service
 */
export class BranchSelector {
	private githubService: GitHubService;
	private firestoreService: FirestoreService;
	private branchCache: Map<string, { branches: GitHubBranch[], timestamp: number }> = new Map();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	constructor(
		private readonly authManager: AuthManager,
		private readonly outputChannel: vscode.OutputChannel
	) {
		this.githubService = new GitHubService(authManager, outputChannel);
		this.firestoreService = new FirestoreService(outputChannel);
	}

	/**
	 * Show branch selection QuickPick for a repository
	 */
	public async selectBranch(repo: GitHubRepository): Promise<GitHubBranch | undefined> {
		try {
			// Load branches
			const branches = await this.loadBranches(repo);
			if (!branches || branches.length === 0) {
				vscode.window.showInformationMessage(`No branches found in ${repo.full_name}`);
				return undefined;
			}

			// Load user preferences
			const preferences = await this.loadBranchPreferences(repo.full_name);

			// Create branch items with metadata
			const branchItems = this.createBranchItems(branches, repo, preferences);

			// Sort: recent branches first, then default, then alphabetically
			branchItems.sort((a, b) => {
				// Recent branches first
			if (a.isRecent && !b.isRecent) {
				return -1;
			}
			if (!a.isRecent && b.isRecent) {
				return 1;
			}
			
			// Then user default branch
			if (a.isUserDefault && !b.isUserDefault) {
				return -1;
			}
			if (!a.isUserDefault && b.isUserDefault) {
				return 1;
			}
			
			// Then repo default branch
			if (a.isDefault && !b.isDefault) {
				return -1;
			}
			if (!a.isDefault && b.isDefault) {
				return 1;
			}
			
			// Finally alphabetically
			return a.label.localeCompare(b.label);
		});

			const selected = await vscode.window.showQuickPick(branchItems, {
				placeHolder: `Select a branch from ${repo.full_name}`,
				title: `Branch Selection - ${repo.name}`,
				matchOnDescription: true,
				matchOnDetail: true
			});

			if (!selected) {
				return undefined;
			}

			// Record branch access
			await this.recordBranchAccess(repo.full_name, selected.branch.name);

			this.outputChannel.appendLine(`Selected branch: ${selected.branch.name} in ${repo.full_name}`);
			return selected.branch;

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to load branches: ${error}`);
			this.outputChannel.appendLine(`Branch selection error: ${error}`);
			return undefined;
		}
	}

	/**
	 * Set default branch for a repository
	 */
	public async setDefaultBranch(repo: GitHubRepository): Promise<void> {
		try {
			const branches = await this.loadBranches(repo);
			if (!branches || branches.length === 0) {
				vscode.window.showInformationMessage(`No branches found in ${repo.full_name}`);
				return;
			}

			const preferences = await this.loadBranchPreferences(repo.full_name);
			const currentDefault = preferences?.defaultBranch || repo.default_branch;

			const branchItems = branches.map(branch => ({
				label: branch.name,
				description: branch.name === currentDefault ? '$(star-full) Current default' : '',
				detail: branch.protected ? '$(shield) Protected' : '',
				branch: branch
			}));

			const selected = await vscode.window.showQuickPick(branchItems, {
				placeHolder: `Set default branch for ${repo.full_name}`,
				title: `Default Branch - ${repo.name}`
			});

			if (!selected) {
				return;
			}

			// Save preference
			await this.saveBranchPreference(repo.full_name, selected.branch.name);
			
			vscode.window.showInformationMessage(`Set ${selected.branch.name} as default for ${repo.name}`);
			this.outputChannel.appendLine(`Set default branch: ${selected.branch.name} for ${repo.full_name}`);

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to set default branch: ${error}`);
			this.outputChannel.appendLine(`Set default branch error: ${error}`);
		}
	}

	/**
	 * Load branches for a repository (with caching)
	 */
	private async loadBranches(repo: GitHubRepository): Promise<GitHubBranch[] | null> {
		const cacheKey = repo.full_name;
		const cached = this.branchCache.get(cacheKey);

		// Return cached if valid
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			this.outputChannel.appendLine(`Using cached branches for ${repo.full_name}`);
			return cached.branches;
		}

		// Fetch from GitHub
		this.outputChannel.appendLine(`Fetching branches for ${repo.full_name}`);
		const branches = await this.githubService.listBranches(repo.owner.login, repo.name);

		if (branches) {
			this.branchCache.set(cacheKey, { branches, timestamp: Date.now() });
		}

		return branches;
	}

	/**
	 * Create QuickPick items from branches
	 */
	private createBranchItems(
		branches: GitHubBranch[],
		repo: GitHubRepository,
		preferences?: RepoBranchPreferences
	): Array<{ label: string; description: string; detail: string; branch: GitHubBranch; isRecent: boolean; isDefault: boolean; isUserDefault: boolean }> {
		const recentBranches = preferences?.recentBranches || [];
		const userDefaultBranch = preferences?.defaultBranch;

		return branches.map(branch => {
			const isRecent = recentBranches.includes(branch.name);
			const isDefault = branch.name === repo.default_branch;
			const isUserDefault = branch.name === userDefaultBranch;

			const label = `$(git-branch) ${branch.name}`;
			let description = '';
			const details: string[] = [];

			// Add badges
			if (isUserDefault) {
				description = '$(star-full) Your Default';
			} else if (isDefault) {
				description = '$(home) Repository Default';
			} else if (isRecent) {
				description = '$(history) Recent';
			}

			// Add details
			if (branch.protected) {
				details.push('$(shield) Protected');
			}
			details.push(`$(git-commit) ${branch.commit.sha.substring(0, 7)}`);

			return {
				label,
				description,
				detail: details.join(' • '),
				branch,
				isRecent,
				isDefault,
				isUserDefault
			};
		});
	}

	/**
	 * Load branch preferences from Firestore
	 */
	private async loadBranchPreferences(repoFullName: string): Promise<RepoBranchPreferences | undefined> {
		try {
			const user = this.authManager.getCurrentUser();
			if (!user) {
				return undefined;
			}

			const profile = await this.firestoreService.getUserProfile(user.uid);
			if (!profile) {
				return undefined;
			}

			// For now, we'll use a simple structure in the user profile
			// In the future, this could be a separate collection
			const key = `repoBranches_${repoFullName.replace(/\//g, '_')}`;
			const profileData = profile as unknown as Record<string, unknown>;
			return profileData[key] as RepoBranchPreferences | undefined;

		} catch (error) {
			this.outputChannel.appendLine(`Failed to load branch preferences: ${error}`);
			return undefined;
		}
	}

	/**
	 * Save default branch preference
	 */
	private async saveBranchPreference(repoFullName: string, branchName: string): Promise<void> {
		try {
			const user = this.authManager.getCurrentUser();
			if (!user) {
				throw new Error('User not signed in');
			}

			const key = `repoBranches_${repoFullName.replace(/\//g, '_')}`;
			const preferences: RepoBranchPreferences = {
				repoFullName,
				defaultBranch: branchName,
				recentBranches: [branchName],
				lastUpdated: Date.now()
			};

			await this.firestoreService.saveUserProfile({
				uid: user.uid,
				[key]: preferences
			});

		} catch (error) {
			this.outputChannel.appendLine(`Failed to save branch preference: ${error}`);
			throw error;
		}
	}

	/**
	 * Record branch access for recent tracking
	 */
	private async recordBranchAccess(repoFullName: string, branchName: string): Promise<void> {
		try {
			const user = this.authManager.getCurrentUser();
			if (!user) {
				return;
			}

			const key = `repoBranches_${repoFullName.replace(/\//g, '_')}`;
			const existing = await this.loadBranchPreferences(repoFullName);

			const recentBranches = existing?.recentBranches || [];
			
			// Add to front, remove duplicates, keep max 5
			const updated = [
				branchName,
				...recentBranches.filter(b => b !== branchName)
			].slice(0, 5);

			const preferences: RepoBranchPreferences = {
				repoFullName,
				defaultBranch: existing?.defaultBranch,
				recentBranches: updated,
				lastUpdated: Date.now()
			};

			await this.firestoreService.saveUserProfile({
				uid: user.uid,
				[key]: preferences
			});

		} catch (error) {
			this.outputChannel.appendLine(`Failed to record branch access: ${error}`);
			// Don't throw - this is not critical
		}
	}

	/**
	 * Clear branch cache
	 */
	public clearCache(): void {
		this.branchCache.clear();
		this.outputChannel.appendLine('Branch cache cleared');
	}
}
