import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup mock auth
const mockAuth = { currentUser: null };

// Mock firebase-service BEFORE importing github-api
// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(() => null),
  getFunctions: vi.fn(() => null)
}));

import { fetchJSON, listPromptsViaContents } from '../../modules/github-api.js';

describe('GitHub API Module', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        mockAuth.currentUser = null;
        window.auth = mockAuth;
        localStorage.removeItem('github_access_token');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchJSON', () => {
        it('should fetch and return JSON', async () => {
            const mockData = { id: 1 };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockData
            });

            const result = await fetchJSON('https://api.github.com/test');
            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/test', expect.objectContaining({
                headers: { 'Accept': 'application/vnd.github+json' }
            }));
        });

        it('should include auth token if present', async () => {
            mockAuth.currentUser = { providerData: [{ providerId: 'github.com' }] };
            window.auth.currentUser = mockAuth.currentUser;
            localStorage.setItem('github_access_token', JSON.stringify({
                token: 'gh_token',
                timestamp: Date.now()
            }));

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            await fetchJSON('https://api.github.com/test');

            expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer gh_token'
                })
            }));
        });

        it('should return null on error', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 404
            });

            const result = await fetchJSON('https://api.github.com/test');
            expect(result).toBeNull();
        });
    });

    describe('listPromptsViaContents', () => {
        it('should list md files from repository', async () => {
            const mockContents = [
                { type: 'file', name: 'prompt1.md', path: 'path/prompt1.md', sha: '123' },
                { type: 'file', name: 'config.json', path: 'path/config.json', sha: '456' },
                { type: 'dir', name: 'subdir', path: 'path/subdir' }
            ];

            const mockSubdirContents = [
                 { type: 'file', name: 'prompt2.md', path: 'path/subdir/prompt2.md', sha: '789' }
            ];

            global.fetch.mockImplementation((url) => {
                if (url.includes('subdir')) {
                    return Promise.resolve({ ok: true, json: async () => mockSubdirContents });
                }
                return Promise.resolve({ ok: true, json: async () => mockContents });
            });

            const results = await listPromptsViaContents('owner', 'repo', 'main', 'path');

            expect(results).toHaveLength(2);
            expect(results.map(r => r.name)).toContain('prompt1.md');
            expect(results.map(r => r.name)).toContain('prompt2.md');
        });
    });
});
