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
		// Get the GitHub access token stored by AuthManager
		const token = await this.authManager.getGitHubToken();
		if (!token) {
			this.outputChannel.appendLine('No GitHub access token available');
			return null;
		}
		return token;
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
	 * List user's repositories with pagination support
	 */
	public async listRepositories(options: {
		affiliation?: 'owner' | 'collaborator' | 'organization_member';
		sort?: 'created' | 'updated' | 'pushed' | 'full_name';
		per_page?: number;
		maxPages?: number;
		includeArchived?: boolean;
	} = {}): Promise<GitHubRepository[]> {
		const perPage = options.per_page || 100;
		const maxPages = options.maxPages || 10; // Limit to prevent infinite requests
		
		const params = new URLSearchParams({
			affiliation: options.affiliation || 'owner,collaborator,organization_member',
			sort: options.sort || 'updated',
			per_page: String(perPage)
		});

		// Include archived repos if requested
		if (options.includeArchived !== false) {
			params.set('visibility', 'all'); // This includes archived
		}

		const cacheKey = `repos-full:${params.toString()}`; // Updated cache key for full repo list
		const result = await this.getOrFetch(cacheKey, async () => {
			const allRepositories: GitHubRepository[] = [];
			let page = 1;
			let hasMore = true;

			while (hasMore && page <= maxPages) {
				const pageParams = new URLSearchParams(params);
				pageParams.set('page', String(page));
				
				this.outputChannel.appendLine(`Fetching repositories page ${page}...`);
				const repositories = await this.fetchGitHub<GitHubRepository[]>(`/user/repos?${pageParams}`);
				
				if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
					this.outputChannel.appendLine(`No repositories on page ${page}, stopping pagination`);
					hasMore = false;
				} else {
					this.outputChannel.appendLine(`Page ${page}: Got ${repositories.length} repositories`);
					allRepositories.push(...repositories);
					hasMore = repositories.length === perPage;
					if (!hasMore) {
						this.outputChannel.appendLine(`Last page reached (${repositories.length} < ${perPage})`);
					}
					page++;
				}
			}

			this.outputChannel.appendLine(`Loaded ${allRepositories.length} repositories across ${page - 1} pages`);
			
			// Debug: Show repository ownership breakdown
			const privateCount = allRepositories.filter(r => r.private).length;
			const publicCount = allRepositories.length - privateCount;
			this.outputChannel.appendLine(`Repository breakdown: ${publicCount} public, ${privateCount} private`);
			
			return allRepositories;
		});
		
		return result || [];
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
	 * List branches for a repository with pagination support
	 */
	public async listBranches(owner: string, repo: string, maxPages: number = 5): Promise<GitHubBranch[]> {
		const cacheKey = `branches:${owner}/${repo}`;
		const result = await this.getOrFetch(cacheKey, async () => {
			const allBranches: GitHubBranch[] = [];
			let page = 1;
			let hasMore = true;
			const perPage = 100;

			while (hasMore && page <= maxPages) {
				const branches = await this.fetchGitHub<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`);
				
				if (!branches || !Array.isArray(branches) || branches.length === 0) {
					hasMore = false;
				} else {
					allBranches.push(...branches);
					hasMore = branches.length === perPage;
					page++;
				}
			}

			return allBranches;
		});
		
		return result || [];
	}

	/**
	 * List pull requests for a repository with pagination support
	 */
	public async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', maxPages: number = 3): Promise<GitHubPullRequest[]> {
		const cacheKey = `prs:${owner}/${repo}:${state}`;
		const result = await this.getOrFetch(cacheKey, async () => {
			const allPRs: GitHubPullRequest[] = [];
			let page = 1;
			let hasMore = true;
			const perPage = 100;

			while (hasMore && page <= maxPages) {
				const prs = await this.fetchGitHub<GitHubPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&page=${page}`);
				
				if (!prs || !Array.isArray(prs) || prs.length === 0) {
					hasMore = false;
				} else {
					allPRs.push(...prs);
					hasMore = prs.length === perPage;
					page++;
				}
			}

			return allPRs;
		});
		
		return result || [];
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
