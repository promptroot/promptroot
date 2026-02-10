/**
 * GitHub Service
 * 
 * Handles GitHub API operations with authentication and caching
 */

import * as vscode from 'vscode';
import { AuthManager } from './auth-manager';

/**
 * GitHub repository information
 */
export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
		avatar_url: string;
	};
	description: string | null;
	private: boolean;
	html_url: string;
	default_branch: string;
	language: string | null;
	stargazers_count: number;
	forks_count: number;
	pushed_at: string;
	created_at: string;
	updated_at: string;
}

/**
 * GitHub branch information
 */
export interface GitHubBranch {
	name: string;
	commit: {
		sha: string;
		url: string;
	};
	protected: boolean;
}

/**
 * GitHub pull request information
 */
export interface GitHubPullRequest {
	number: number;
	title: string;
	state: 'open' | 'closed';
	html_url: string;
	user: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	merged_at: string | null;
	head: {
		ref: string;
		sha: string;
	};
	base: {
		ref: string;
		sha: string;
	};
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const GITHUB_API_BASE = 'https://api.github.com';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class GitHubService {
	private cache: Map<string, CacheEntry<unknown>> = new Map();
	private outputChannel: vscode.OutputChannel;
	private authManager: AuthManager;

	constructor(authManager: AuthManager, outputChannel: vscode.OutputChannel) {
		this.authManager = authManager;
		this.outputChannel = outputChannel;
	}

	/**
	 * Get GitHub access token
	 */
	private async getAccessToken(): Promise<string | null> {
		const user = this.authManager.getCurrentUser();
		if (!user) {
			return null;
		}

		// Check if user is authenticated with GitHub
		const isGitHubAuth = user.providerData?.some((p: { providerId: string }) => p.providerId === 'github.com');
		if (!isGitHubAuth) {
			return null;
		}

		// Get token from Firebase user
		try {
			const token = await user.getIdToken();
			return token;
		} catch (error) {
			this.outputChannel.appendLine(`Error getting GitHub token: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return null;
		}
	}

	/**
	 * Make authenticated GitHub API request
	 */
	private async fetchGitHub<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
		try {
			const token = await this.getAccessToken();
			const headers: Record<string, string> = {
				'Accept': 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				...((options.headers as Record<string, string>) || {})
			};

			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const url = `${GITHUB_API_BASE}${endpoint}`;
			this.outputChannel.appendLine(`GitHub API: ${options.method || 'GET'} ${endpoint}`);

			const response = await fetch(url, {
				...options,
				headers
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			return await response.json() as T;
		} catch (error) {
			this.outputChannel.appendLine(`GitHub API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return null;
		}
	}

	/**
	 * Get cached data or fetch if expired
	 */
	private async getOrFetch<T>(cacheKey: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
		const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			this.outputChannel.appendLine(`Cache hit: ${cacheKey}`);
			return cached.data;
		}

		const data = await fetchFn();
		if (data) {
			this.cache.set(cacheKey, {
				data,
				timestamp: Date.now()
			});
		}

		return data;
	}

	/**
	 * Clear cache
	 */
	public clearCache(pattern?: string): void {
		if (!pattern) {
			this.cache.clear();
			this.outputChannel.appendLine('GitHub cache cleared');
			return;
		}

		const keysToDelete: string[] = [];
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				keysToDelete.push(key);
			}
		}

		keysToDelete.forEach(key => this.cache.delete(key));
		this.outputChannel.appendLine(`GitHub cache cleared: ${keysToDelete.length} entries matching "${pattern}"`);
	}

	/**
	 * List user's repositories
	 */
	public async listRepositories(options: {
		affiliation?: 'owner' | 'collaborator' | 'organization_member';
		sort?: 'created' | 'updated' | 'pushed' | 'full_name';
		per_page?: number;
	} = {}): Promise<GitHubRepository[]> {
		const params = new URLSearchParams({
			affiliation: options.affiliation || 'owner,collaborator',
			sort: options.sort || 'updated',
			per_page: String(options.per_page || 100)
		});

		const cacheKey = `repos:${params.toString()}`;
		return await this.getOrFetch(cacheKey, async () => {
			return await this.fetchGitHub<GitHubRepository[]>(`/user/repos?${params}`);
		}) || [];
	}

	/**
	 * Get repository details
	 */
	public async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
		const cacheKey = `repo:${owner}/${repo}`;
		return await this.getOrFetch(cacheKey, async () => {
			return await this.fetchGitHub<GitHubRepository>(`/repos/${owner}/${repo}`);
		});
	}

	/**
	 * List branches for a repository
	 */
	public async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
		const cacheKey = `branches:${owner}/${repo}`;
		return await this.getOrFetch(cacheKey, async () => {
			return await this.fetchGitHub<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
		}) || [];
	}

	/**
	 * List pull requests for a repository
	 */
	public async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
		const cacheKey = `prs:${owner}/${repo}:${state}`;
		return await this.getOrFetch(cacheKey, async () => {
			return await this.fetchGitHub<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100`);
		}) || [];
	}

	/**
	 * Search repositories
	 */
	public async searchRepositories(query: string, per_page: number = 30): Promise<{ items: GitHubRepository[] } | null> {
		const cacheKey = `search:${query}:${per_page}`;
		return await this.getOrFetch(cacheKey, async () => {
			const encoded = encodeURIComponent(query);
			return await this.fetchGitHub<{ items: GitHubRepository[] }>(`/search/repositories?q=${encoded}&per_page=${per_page}`);
		});
	}

	/**
	 * Get authenticated user
	 */
	public async getAuthenticatedUser(): Promise<{ login: string; avatar_url: string; name: string | null } | null> {
		return await this.fetchGitHub('/user');
	}
}
