/**
 * Tests for RepositoryTreeProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RepositoryTreeProvider, RepositoryTreeItem, RepositoryItemType } from '../repository-tree-provider';

// FirestoreService touches Firebase in its constructor; stub it so the provider
// can be constructed without an initialized Firebase app.
vi.mock('../firestore-service', () => ({
	FirestoreService: vi.fn(() => ({
		getUserProfile: vi.fn().mockResolvedValue(null),
		saveUserProfile: vi.fn().mockResolvedValue(undefined)
	}))
}));

describe('RepositoryTreeProvider', () => {
	let mockAuthManager: {
		getAccessToken: ReturnType<typeof vi.fn>;
		getCurrentUser: ReturnType<typeof vi.fn>;
		isSignedIn: ReturnType<typeof vi.fn>;
		onAuthStateChanged: ReturnType<typeof vi.fn>;
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
	let provider: RepositoryTreeProvider;

	beforeEach(() => {
		// Mock AuthManager
		mockAuthManager = {
			getAccessToken: vi.fn().mockResolvedValue('test-token'),
			getCurrentUser: vi.fn().mockReturnValue({ uid: 'test-uid' }),
			isSignedIn: vi.fn().mockReturnValue(true),
			onAuthStateChanged: vi.fn()
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

		provider = new RepositoryTreeProvider(mockAuthManager as any, mockOutputChannel as any);
	});

	describe('getTreeItem', () => {
		it('should return the tree item as-is', () => {
			const item = new RepositoryTreeItem('Test', RepositoryItemType.LOADING);
			const result = provider.getTreeItem(item);
			expect(result).toBe(item);
		});
	});

	describe('getChildren', () => {
		it('should show sign-in prompt when not authenticated', async () => {
			mockAuthManager.isSignedIn.mockReturnValue(false);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(provider as any).authChecked = true;

			const children = await provider.getChildren();

			expect(children).toHaveLength(1);
			expect(children[0].label).toContain('Sign in');
		});

		it('should show Favorites and All Repositories groups at root', async () => {
			mockAuthManager.isSignedIn.mockReturnValue(true);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(provider as any).authChecked = true;

			const children = await provider.getChildren();

			expect(children).toHaveLength(2);
			expect(children[0].type).toBe(RepositoryItemType.FAVORITES_GROUP);
			expect(children[1].type).toBe(RepositoryItemType.ALL_REPOS_GROUP);
		});
	});

	describe('favorites management', () => {
		it('should check if repository is favorited', () => {
			expect(provider.isFavorite('user/repo')).toBe(false);
		});

		it('should add repository to favorites', async () => {
			// Mock Firestore read + save
			const mockFirestoreService = {
				getUserProfile: vi.fn().mockResolvedValue(null),
				saveUserProfile: vi.fn().mockResolvedValue(undefined)
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(provider as any).firestoreService = mockFirestoreService;

			await provider.addFavorite('user/test-repo');

			expect(provider.isFavorite('user/test-repo')).toBe(true);
			// Favorites are persisted in the web-app object format, not plain strings.
			expect(mockFirestoreService.saveUserProfile).toHaveBeenCalledWith(
				expect.objectContaining({
					uid: 'test-uid',
					favoriteRepos: [
						{ branch: 'main', id: 'sources/github/user/test-repo', name: 'user/test-repo' }
					]
				})
			);
		});

		it('should remove repository from favorites', async () => {
			// Mock Firestore read + save
			const mockFirestoreService = {
				getUserProfile: vi.fn().mockResolvedValue(null),
				saveUserProfile: vi.fn().mockResolvedValue(undefined)
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(provider as any).firestoreService = mockFirestoreService;

			// Add then remove
			await provider.addFavorite('user/test-repo');
			await provider.removeFavorite('user/test-repo');

			expect(provider.isFavorite('user/test-repo')).toBe(false);
		});
	});

	describe('refresh', () => {
		it('should fire onDidChangeTreeData event', () => {
			const spy = vi.fn();
			provider.onDidChangeTreeData(spy);

			provider.refresh();

			expect(spy).toHaveBeenCalled();
		});
	});

	describe('dispose', () => {
		it('should clean up resources', () => {
			expect(() => provider.dispose()).not.toThrow();
		});
	});
});

describe('RepositoryTreeItem', () => {
	it('should create loading item', () => {
		const item = new RepositoryTreeItem('Loading...', RepositoryItemType.LOADING);
		
		expect(item.label).toBe('Loading...');
		expect(item.type).toBe(RepositoryItemType.LOADING);
	});

	it('should create favorites group item', () => {
		const item = new RepositoryTreeItem(
			'Favorites',
			RepositoryItemType.FAVORITES_GROUP,
			undefined,
			1 // TreeItemCollapsibleState.Expanded
		);
		
		expect(item.label).toBe('Favorites');
		expect(item.type).toBe(RepositoryItemType.FAVORITES_GROUP);
		expect(item.contextValue).toBe('favoritesGroup');
	});

	it('should create repository item with metadata', () => {
		const mockRepo = {
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
		};

		const item = new RepositoryTreeItem(
			'test-repo',
			RepositoryItemType.REPOSITORY,
			mockRepo,
			0, // TreeItemCollapsibleState.None
			'repository-public'
		);
		
		expect(item.label).toBe('test-repo');
		expect(item.type).toBe(RepositoryItemType.REPOSITORY);
		expect(item.repository).toBe(mockRepo);
		expect(item.description).toBe('Public');
		expect(item.contextValue).toBe('repository-public');
	});

	it('should show private badge for private repositories', () => {
		const mockRepo = {
			id: 2,
			name: 'private-repo',
			full_name: 'user/private-repo',
			owner: { login: 'user', avatar_url: 'https://example.com/avatar.png' },
			description: 'Private repository',
			private: true,
			html_url: 'https://github.com/user/private-repo',
			default_branch: 'main',
			language: 'JavaScript',
			stargazers_count: 0,
			forks_count: 0,
			pushed_at: '2026-02-10T00:00:00Z',
			created_at: '2025-01-01T00:00:00Z',
			updated_at: '2026-02-10T00:00:00Z'
		};

		const item = new RepositoryTreeItem(
			'private-repo',
			RepositoryItemType.REPOSITORY,
			mockRepo,
			0,
			'repository-private'
		);
		
		expect(item.description).toBe('Private');
		expect(item.contextValue).toBe('repository-private');
	});
});
