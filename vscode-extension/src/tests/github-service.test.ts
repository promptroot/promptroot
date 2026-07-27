/**
 * Tests for GitHubService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubService, GitHubRepository, GitHubBranch } from '../github-service';

describe('GitHubService', () => {
	let mockAuthManager: {
		getAccessToken: ReturnType<typeof vi.fn>;
		getGitHubToken: ReturnType<typeof vi.fn>;
		getCurrentUser: ReturnType<typeof vi.fn>;
		isSignedIn: ReturnType<typeof vi.fn>;
	};
	let mockOutputChannel: {
		appendLine: ReturnType<typeof vi.fn>;
		append: ReturnType<typeof vi.fn>;
		clear: ReturnType<typeof vi.fn>;
		show: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		dispose: ReturnType<typeof vi.fn>;
		name: string;
	};
	let service: GitHubService;

	beforeEach(() => {
		// Mock AuthManager
		mockAuthManager = {
			getAccessToken: vi.fn().mockResolvedValue('test-token'),
			getGitHubToken: vi.fn().mockResolvedValue('test-token'),
			getCurrentUser: vi.fn().mockReturnValue({ uid: 'test-uid' }),
			isSignedIn: vi.fn().mockReturnValue(true)
		};

		// Mock OutputChannel
		mockOutputChannel = {
			appendLine: vi.fn(),
			append: vi.fn(),
			clear: vi.fn(),
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			name: 'Test'
		};

		service = new GitHubService(mockAuthManager as any, mockOutputChannel as any);
	});

	describe('listRepositories', () => {
		it('should fetch user repositories', async () => {
			const mockRepos: GitHubRepository[] = [
				{
					id: 1,
					name: 'test-repo',
					full_name: 'user/test-repo',
					owner: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
					description: 'Test repository',
					private: false,
					html_url: 'https://github.com/user/test-repo',
					default_branch: 'main',
					language: 'TypeScript',
					stargazers_count: 10,
					forks_count: 5,
					pushed_at: '2026-02-10T00:00:00Z',
					created_at: '2025-01-01T00:00:00Z',
					updated_at: '2026-02-10T00:00:00Z'
				}
			];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockRepos
			} as Response);

			const repos = await service.listRepositories();

			expect(repos).toEqual(mockRepos);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('https://api.github.com/user/repos'),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Bearer test-token'
					})
				})
			);
		});

		it('should return null on API error', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: 'Unauthorized'
			} as Response);

			const repos = await service.listRepositories();

			// The service normalizes errors to an empty array (result || []).
			expect(repos).toEqual([]);
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringContaining('GitHub API error')
			);
		});

		it('should use cached data when within TTL', async () => {
			const mockRepos: GitHubRepository[] = [{
				id: 1,
				name: 'cached-repo',
				full_name: 'user/cached-repo',
				owner: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
				description: 'Cached repository',
				private: false,
				html_url: 'https://github.com/user/cached-repo',
				default_branch: 'main',
				language: 'JavaScript',
				stargazers_count: 5,
				forks_count: 2,
				pushed_at: '2026-02-10T00:00:00Z',
				created_at: '2025-01-01T00:00:00Z',
				updated_at: '2026-02-10T00:00:00Z'
			}];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockRepos
			} as Response);

			// First call - should fetch
			await service.listRepositories();
			expect(global.fetch).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			await service.listRepositories();
			expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
		});
	});

	describe('listBranches', () => {
		it('should fetch branches for a repository', async () => {
			const mockBranches: GitHubBranch[] = [
				{
					name: 'main',
					commit: { sha: 'abc123', url: 'https://api.github.com/repos/user/repo/commits/abc123' },
					protected: true
				},
				{
					name: 'develop',
					commit: { sha: 'def456', url: 'https://api.github.com/repos/user/repo/commits/def456' },
					protected: false
				}
			];

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockBranches
			} as Response);

			const branches = await service.listBranches('user', 'repo');

			expect(branches).toEqual(mockBranches);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('https://api.github.com/repos/user/repo/branches'),
				expect.any(Object)
			);
		});

		it('should return null when repository not found', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found'
			} as Response);

			const branches = await service.listBranches('user', 'nonexistent');

			// The service normalizes errors to an empty array (result || []).
			expect(branches).toEqual([]);
		});
	});

	describe('searchRepositories', () => {
		it('should search repositories with query', async () => {
			const mockResult = {
				total_count: 1,
				items: [{
					id: 1,
					name: 'search-result',
					full_name: 'user/search-result',
					owner: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
					description: 'Search result repository',
					private: false,
					html_url: 'https://github.com/user/search-result',
					default_branch: 'main',
					language: 'Python',
					stargazers_count: 100,
					forks_count: 20,
					pushed_at: '2026-02-10T00:00:00Z',
					created_at: '2025-01-01T00:00:00Z',
					updated_at: '2026-02-10T00:00:00Z'
				}]
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockResult
			} as Response);

			const result = await service.searchRepositories('language:python stars:>50');

			expect(result).toEqual(mockResult);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('https://api.github.com/search/repositories'),
				expect.any(Object)
			);
		});

		it('should handle search with no results', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ total_count: 0, items: [] })
			} as Response);

			const result = await service.searchRepositories('nonexistent-repo-xyz123');

			expect(result).toEqual({ total_count: 0, items: [] });
		});
	});

	describe('authentication', () => {
		it('should include Authorization header when token available', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => []
			} as Response);

			await service.listRepositories();

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Bearer test-token'
					})
				})
			);
		});

		it('should make request without Authorization when no token', async () => {
			mockAuthManager.getGitHubToken.mockResolvedValue(null);

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => []
			} as Response);

			await service.listRepositories();

			const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const headers = call[1].headers;
			
			expect(headers['Authorization']).toBeUndefined();
		});
	});
});
