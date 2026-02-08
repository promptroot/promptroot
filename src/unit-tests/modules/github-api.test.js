import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock firebase-service BEFORE importing github-api
const mockAuth = {
  currentUser: null
};

// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(() => null),
  getFunctions: vi.fn(() => null)
}));

import {
  setViaProxy,
  fetchJSON,
  fetchJSONWithETag,
  listPromptsViaContents,
  listPromptsViaTrees,
  fetchRawFile,
  resolveGistRawUrl,
  fetchGistContent,
  isGistPointer,
  isGistUrl,
  getBranches,
  getRateLimitInfo,
  clearCaches
} from '../../modules/github-api.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Keep window.auth for backward compatibility with tests
global.window = global.window || {};
global.window.auth = mockAuth;

// Mock localStorage
const mockLocalStorage = (() => {
  let storage = {};
  return {
    getItem: vi.fn((key) => storage[key] || null),
    setItem: vi.fn((key, value) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      storage = {};
    })
  };
})();

// Mock localStorage with proper property descriptor
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

// Mock console.error to avoid test output noise
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('github-api', () => {
  beforeEach(() => {
    // Clear all mocks including implementations
    mockFetch.mockClear();
    mockFetch.mockReset();
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    mockLocalStorage.clear();
    mockConsoleError.mockClear();
    
    // Clear module caches
    clearCaches();
    
    // Reset proxy function to default (identity function)
    setViaProxy((url) => url);
    
    // Mock Date.now for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setViaProxy', () => {
    it('should set proxy function', async () => {
      const proxyFn = vi.fn((url) => `proxied:${url}`);
      setViaProxy(proxyFn);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await fetchJSON('https://api.github.com/test');

      expect(proxyFn).toHaveBeenCalledWith('https://api.github.com/test');
      expect(mockFetch).toHaveBeenCalledWith('proxied:https://api.github.com/test', expect.any(Object));
      
      // Reset to default for other tests
      setViaProxy((url) => url);
    });

    it('should handle multiple proxy function changes', () => {
      const proxy1 = (url) => `proxy1:${url}`;
      const proxy2 = (url) => `proxy2:${url}`;

      setViaProxy(proxy1);
      setViaProxy(proxy2);

      // The last one should be active - we can't directly test this without making a request
      // so this test just verifies the function doesn't throw
      expect(() => setViaProxy(proxy2)).not.toThrow();
      
      // Reset to default for other tests
      setViaProxy((url) => url);
    });
  });

  describe('fetchJSON', () => {
    it('should fetch JSON without authentication', async () => {
      const expectedData = { message: 'success' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedData)
      });

      const result = await fetchJSON('https://api.github.com/test');

      expect(result).toEqual(expectedData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: { 'Accept': 'application/vnd.github+json' }
        }
      );
    });

    it('should fetch JSON with GitHub authentication', async () => {
      // Setup authenticated user
      mockAuth.currentUser = {
        providerData: [{ providerId: 'github.com' }]
      };
      mockLocalStorage.setItem('github_access_token', JSON.stringify({
        token: 'github_pat_12345',
        timestamp: 1000000 - 1000 // 1 second ago
      }));

      const expectedData = { message: 'authenticated' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedData)
      });

      const result = await fetchJSON('https://api.github.com/test');

      expect(result).toEqual(expectedData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': 'Bearer github_pat_12345'
          }
        }
      );
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchJSON('https://api.github.com/test');

      expect(result).toBeNull();
      expect(mockConsoleError).toHaveBeenCalledWith('GitHub API fetch failed:', expect.any(Error));
    });

    it('should return null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const result = await fetchJSON('https://api.github.com/test');

      expect(result).toBeNull();
    });

    it('should handle expired token', async () => {
      mockAuth.currentUser = {
        providerData: [{ providerId: 'github.com' }]
      };
      
      // Set expired token (older than TOKEN_MAX_AGE)
      const expiredTime = 1000000 - (60 * 24 * 60 * 60 * 1000 + 1000); // 60 days + 1 second ago
      mockLocalStorage.setItem('github_access_token', JSON.stringify({
        token: 'expired_token',
        timestamp: expiredTime
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await fetchJSON('https://api.github.com/test');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('github_access_token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: { 'Accept': 'application/vnd.github+json' }
        }
      );
    });

    it('should handle invalid token data', async () => {
      mockAuth.currentUser = {
        providerData: [{ providerId: 'github.com' }]
      };
      mockLocalStorage.setItem('github_access_token', 'invalid-json');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await fetchJSON('https://api.github.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: { 'Accept': 'application/vnd.github+json' }
        }
      );
    });

    it('should handle non-GitHub auth provider', async () => {
      mockAuth.currentUser = {
        providerData: [{ providerId: 'google.com' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      });

      await fetchJSON('https://api.github.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: { 'Accept': 'application/vnd.github+json' }
        }
      );
    });
  });

  describe('fetchJSONWithETag', () => {
    it('should fetch JSON with ETag', async () => {
      const expectedData = { message: 'success' };
      const etag = '"abc123"';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedData),
        headers: {
          get: vi.fn((header) => header === 'ETag' ? etag : null)
        }
      });

      const result = await fetchJSONWithETag('https://api.github.com/test');

      expect(result).toEqual({
        data: expectedData,
        etag: etag,
        notModified: false
      });
    });

    it('should handle 304 Not Modified response', async () => {
      const existingEtag = '"existing123"';
      
      mockFetch.mockResolvedValueOnce({
        status: 304,
        ok: false
      });

      const result = await fetchJSONWithETag('https://api.github.com/test', existingEtag);

      expect(result).toEqual({
        notModified: true,
        etag: existingEtag
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: {
            'Accept': 'application/vnd.github+json',
            'If-None-Match': existingEtag
          }
        }
      );
    });

    it('should handle HTTP error with error object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await fetchJSONWithETag('https://api.github.com/test');

      expect(result.data).toBeNull();
      expect(result.etag).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.status).toBe(404);
    });

    it('should handle fetch exception', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(networkError);

      const result = await fetchJSONWithETag('https://api.github.com/test');

      expect(result.data).toBeNull();
      expect(result.etag).toBeNull();
      expect(result.error).toBe(networkError);
      expect(mockConsoleError).toHaveBeenCalledWith('GitHub API fetch with ETag failed:', networkError);
    });

    it('should include authorization header when authenticated', async () => {
      mockAuth.currentUser = {
        providerData: [{ providerId: 'github.com' }]
      };
      mockLocalStorage.setItem('github_access_token', JSON.stringify({
        token: 'github_pat_12345',
        timestamp: 999000
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
        headers: {
          get: () => null
        }
      });

      await fetchJSONWithETag('https://api.github.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/test',
        {
          cache: 'no-store',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': 'Bearer github_pat_12345'
          }
        }
      );
    });
  });

  describe('listPromptsViaContents', () => {
    it('should list markdown files from contents API', async () => {
      const contentsResponse = [
        {
          type: 'file',
          name: 'prompt1.md',
          path: 'prompts/prompt1.md',
          sha: 'sha1',
          download_url: 'https://raw.githubusercontent.com/user/repo/main/prompts/prompt1.md'
        },
        {
          type: 'file',
          name: 'readme.txt',
          path: 'prompts/readme.txt'
        },
        {
          type: 'dir',
          name: 'subfolder',
          path: 'prompts/subfolder'
        }
      ];

      const subfolderResponse = [
        {
          type: 'file',
          name: 'nested.md',
          path: 'prompts/subfolder/nested.md',
          sha: 'sha2',
          download_url: 'https://raw.githubusercontent.com/user/repo/main/prompts/subfolder/nested.md'
        }
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(contentsResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(subfolderResponse)
        });

      const result = await listPromptsViaContents('user', 'repo', 'main');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'file',
        name: 'prompt1.md',
        path: 'prompts/prompt1.md',
        sha: 'sha1',
        download_url: 'https://raw.githubusercontent.com/user/repo/main/prompts/prompt1.md'
      });
      expect(result[1]).toEqual({
        type: 'file',
        name: 'nested.md',
        path: 'prompts/subfolder/nested.md',
        sha: 'sha2',
        download_url: 'https://raw.githubusercontent.com/user/repo/main/prompts/subfolder/nested.md'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle custom path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      await listPromptsViaContents('user', 'repo', 'main', 'custom/path');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/user/repo/contents/custom/path?ref=main&ts=1000000',
        expect.any(Object)
      );
    });

    it('should return empty array for non-array response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      });

      const result = await listPromptsViaContents('user', 'repo', 'main');

      expect(result).toEqual([]);
    });

    it('should handle URL encoding for special characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      await listPromptsViaContents('user/name', 'repo-name', 'feature/branch', 'path with spaces');

      const expectedUrl = 'https://api.github.com/repos/user%2Fname/repo-name/contents/path%20with%20spaces?ref=feature%2Fbranch&ts=1000000';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });

  describe('listPromptsViaTrees', () => {
    it('should list prompts via trees API', async () => {
      const treeResponse = {
        tree: [
          {
            type: 'blob',
            path: 'prompts/file1.md',
            sha: 'sha1'
          },
          {
            type: 'blob',
            path: 'prompts/subfolder/file2.md',
            sha: 'sha2'
          },
          {
            type: 'blob',
            path: 'other/file.md',
            sha: 'sha3'
          },
          {
            type: 'tree',
            path: 'prompts/folder'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(treeResponse),
        headers: {
          get: vi.fn((header) => header === 'ETag' ? '"tree-etag"' : null)
        }
      });

      const result = await listPromptsViaTrees('user', 'repo', 'main');

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        type: 'file',
        name: 'file1.md',
        path: 'prompts/file1.md',
        sha: 'sha1'
      });
      expect(result.files[1]).toEqual({
        type: 'file',
        name: 'file2.md',
        path: 'prompts/subfolder/file2.md',
        sha: 'sha2'
      });
      expect(result.etag).toBe('"tree-etag"');
    });

    it('should handle not modified response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 304,
        ok: false
      });

      const result = await listPromptsViaTrees('user', 'repo', 'main', 'prompts', '"existing-etag"');

      expect(result).toEqual({
        notModified: true,
        etag: '"existing-etag"'
      });
    });

    it('should handle custom path filtering', async () => {
      const treeResponse = {
        tree: [
          {
            type: 'blob',
            path: 'custom/path/file1.md',
            sha: 'sha1'
          },
          {
            type: 'blob',
            path: 'other/path/file2.md',
            sha: 'sha2'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(treeResponse),
        headers: {
          get: () => null
        }
      });

      const result = await listPromptsViaTrees('user', 'repo', 'main', 'custom/path');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('custom/path/file1.md');
    });

    it('should throw error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(listPromptsViaTrees('user', 'repo', 'main')).rejects.toThrow('GitHub API request failed: 404 Not Found');
    });

    it('should throw error when tree data is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
        headers: {
          get: () => null
        }
      });

      await expect(listPromptsViaTrees('user', 'repo', 'main')).rejects.toThrow('Failed to fetch tree data');
    });

    it('should handle special characters in path regex', async () => {
      const treeResponse = {
        tree: [
          {
            type: 'blob',
            path: 'path[special]/file.md',
            sha: 'sha1'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(treeResponse),
        headers: {
          get: () => null
        }
      });

      const result = await listPromptsViaTrees('user', 'repo', 'main', 'path[special]');

      expect(result.files).toHaveLength(1);
    });
  });

  describe('fetchRawFile', () => {
    it('should fetch raw file content', async () => {
      const expectedContent = '# Test Prompt\nThis is test content';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(expectedContent)
      });

      const result = await fetchRawFile('user', 'repo', 'main', 'prompts/test.md');

      expect(result).toBe(expectedContent);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/user/repo/main/prompts/test.md?ts=1000000',
        { cache: 'no-store' }
      );
    });

    it('should handle URL encoding in file path', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('content')
      });

      await fetchRawFile('user/name', 'repo-name', 'feature/branch', 'path with spaces/file.md');

      const expectedUrl = 'https://raw.githubusercontent.com/user%2Fname/repo-name/feature%2Fbranch/path%20with%20spaces/file.md?ts=1000000';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, { cache: 'no-store' });
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(fetchRawFile('user', 'repo', 'main', 'nonexistent.md')).rejects.toThrow('Failed to fetch: 404');
    });
  });

  describe('resolveGistRawUrl', () => {
    it('should return gist pointer URL as-is', async () => {
      const gistUrl = 'https://gist.githubusercontent.com/user/abc123/raw/file.md';
      
      const result = await resolveGistRawUrl(gistUrl);

      expect(result).toBe(gistUrl);
    });

    it('should resolve gist URL with file fragment', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123#file-test-md';
      
      const result = await resolveGistRawUrl(gistUrl);

      expect(result).toBe('https://gist.githubusercontent.com/user/abc123/raw/test-md');
    });

    it('should resolve gist URL with file query parameter', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123?file=example.md';
      
      const result = await resolveGistRawUrl(gistUrl);

      expect(result).toBe('https://gist.githubusercontent.com/user/abc123/raw/example.md');
    });

    it('should resolve gist URL by fetching metadata', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123';
      const gistData = {
        files: {
          'readme.txt': {},
          'prompt.md': {},
          'other.py': {}
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(gistData)
      });

      const result = await resolveGistRawUrl(gistUrl);

      expect(result).toBe('https://gist.githubusercontent.com/user/abc123/raw/prompt.md');
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/gists/abc123');
    });

    it('should fallback to first file if no markdown file', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123';
      const gistData = {
        files: {
          'first.txt': {},
          'second.py': {}
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(gistData)
      });

      const result = await resolveGistRawUrl(gistUrl);

      expect(result).toBe('https://gist.githubusercontent.com/user/abc123/raw/first.txt');
    });

    it('should throw error for invalid gist URL format', async () => {
      const invalidUrl = 'https://example.com/not-a-gist';

      await expect(resolveGistRawUrl(invalidUrl)).rejects.toThrow('Invalid gist URL format');
    });

    it('should throw error when gist API fails', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(resolveGistRawUrl(gistUrl)).rejects.toThrow('Failed to fetch gist metadata: 404');
    });

    it('should throw error when gist has no files', async () => {
      const gistUrl = 'https://gist.github.com/user/abc123';
      const gistData = { files: {} };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(gistData)
      });

      await expect(resolveGistRawUrl(gistUrl)).rejects.toThrow('No files found in gist');
    });
  });

  describe('fetchGistContent', () => {
    it('should fetch gist content', async () => {
      const expectedContent = '# Gist Content\nTest gist';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(expectedContent)
      });

      const result = await fetchGistContent('https://gist.githubusercontent.com/user/abc123/raw/file.md');

      expect(result).toBe(expectedContent);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://gist.githubusercontent.com/user/abc123/raw/file.md?ts=1000000',
        { cache: 'no-store' }
      );
    });

    it('should use cache for repeated requests', async () => {
      const content = 'Cached content';
      const cache = new Map();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(content)
      });

      const url = 'https://gist.githubusercontent.com/user/abc123/raw/file.md';

      // First call
      const result1 = await fetchGistContent(url, cache);
      
      // Second call should use cache
      const result2 = await fetchGistContent(url, cache);

      expect(result1).toBe(content);
      expect(result2).toBe(content);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cache.has('gist:' + url)).toBe(true);
    });

    it('should handle URLs with existing query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('content')
      });

      await fetchGistContent('https://gist.githubusercontent.com/user/abc123/raw/file.md?param=value');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gist.githubusercontent.com/user/abc123/raw/file.md?param=value&ts=1000000',
        { cache: 'no-store' }
      );
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fetchGistContent('https://gist.githubusercontent.com/user/abc123/raw/file.md'))
        .rejects.toThrow('Gist fetch failed: 404 Not Found');
    });
  });

  describe('isGistPointer', () => {
    it('should detect gist pointer URLs', () => {
      expect(isGistPointer('https://gist.githubusercontent.com/user/abc123/raw/file.md')).toBe(true);
      expect(isGistPointer('  https://gist.githubusercontent.com/user/abc123/raw/file.md  ')).toBe(true);
    });

    it('should detect regular gist URLs', () => {
      expect(isGistPointer('https://gist.github.com/user/abc123')).toBe(true);
      expect(isGistPointer('https://gist.github.com/user/abc123#file-test-md')).toBe(true);
    });

    it('should reject non-gist URLs', () => {
      expect(isGistPointer('https://github.com/user/repo')).toBe(false);
      expect(isGistPointer('https://example.com')).toBe(false);
      expect(isGistPointer('not a url')).toBe(false);
      expect(isGistPointer('')).toBe(false);
    });
  });

  describe('isGistUrl', () => {
    it('should detect gist URLs', () => {
      expect(isGistUrl('https://gist.github.com/user/abc123')).toBe(true);
      expect(isGistUrl('https://gist.githubusercontent.com/user/abc123/raw/file.md')).toBe(true);
    });

    it('should reject non-gist URLs', () => {
      expect(isGistUrl('https://github.com/user/repo')).toBe(false);
      expect(isGistUrl('https://example.com')).toBe(false);
    });
  });

  describe('getBranches', () => {
    it('should fetch branches with pagination', async () => {
      const branches1 = new Array(100).fill(0).map((_, i) => ({ name: `branch${i}` }));
      const branches2 = new Array(50).fill(0).map((_, i) => ({ name: `branch${i + 100}` }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(branches1)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(branches2)
        });

      const result = await getBranches('user', 'repo');

      expect(result).toHaveLength(150);
      expect(result[0].name).toBe('branch0');
      expect(result[149].name).toBe('branch149');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle single page of branches', async () => {
      const branches = [
        { name: 'main' },
        { name: 'develop' },
        { name: 'feature-branch' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(branches)
      });

      const result = await getBranches('user', 'repo');

      expect(result).toEqual(branches);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty branches response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const result = await getBranches('user', 'repo');

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      });

      const result = await getBranches('user', 'repo');

      expect(result).toEqual([]);
    });

    it('should stop at max pages limit', async () => {
      const fullPageBranches = new Array(100).fill(0).map((_, i) => ({ name: `branch${i}` }));

      // Mock 11 responses (exceeding maxPages of 10)
      for (let i = 0; i < 11; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(fullPageBranches)
        });
      }

      const result = await getBranches('user', 'repo');

      expect(result).toHaveLength(1000); // 10 pages * 100 branches
      expect(mockFetch).toHaveBeenCalledTimes(10); // Should stop at maxPages
    });

    it('should handle URL encoding', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      await getBranches('user/name', 'repo-name');

      const expectedUrl = 'https://api.github.com/repos/user%2Fname/repo-name/branches?per_page=100&page=1&ts=1000000';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });

  describe('integration and error handling', () => {
    it('should handle token refresh across multiple API calls', async () => {
      // Mock Date.now for token expiry checks
      let mockTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
      
      mockAuth.currentUser = {
        providerData: [{ providerId: 'github.com' }]
      };
      
      // Set token that will be valid for first call but expire during second
      mockLocalStorage.setItem('github_access_token', JSON.stringify({
        token: 'valid_token',
        timestamp: 999000
      }));

      // First call succeeds with auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'first' })
      });

      const result1 = await fetchJSON('https://api.github.com/test1');
      expect(result1).toEqual({ data: 'first' });

      // Simulate token expiry
      mockTime = 1000000 + 60 * 24 * 60 * 60 * 1000 + 1000;
      
      // Second call should work without auth (token expired and removed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'second' })
      });

      const result2 = await fetchJSON('https://api.github.com/test2');
      expect(result2).toEqual({ data: 'second' });
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('github_access_token');
    });

    it('should handle network failures gracefully across all functions', async () => {
      const networkError = new Error('Network unavailable');
      mockFetch.mockRejectedValue(networkError);

      // Test all functions handle network errors gracefully
      expect(await fetchJSON('https://api.github.com/test')).toBeNull();
      expect((await fetchJSONWithETag('https://api.github.com/test')).data).toBeNull();
      expect(await listPromptsViaContents('user', 'repo', 'main')).toEqual([]);
      await expect(fetchRawFile('user', 'repo', 'main', 'file.md')).rejects.toThrow();
      await expect(fetchGistContent('https://gist.githubusercontent.com/user/abc/raw/file.md')).rejects.toThrow();
      expect(await getBranches('user', 'repo')).toEqual([]);
    });

    it('should maintain proxy settings across different API calls', async () => {
      const proxyFn = vi.fn((url) => `proxy:${url}`);
      setViaProxy(proxyFn);

      // Mock successful responses for different API calls
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
        headers: { get: () => null }
      });

      await fetchJSON('https://api.github.com/test1');
      await getBranches('user', 'repo');

      expect(proxyFn).toHaveBeenCalledWith('https://api.github.com/test1');
      expect(proxyFn).toHaveBeenCalledWith('https://api.github.com/repos/user/repo/branches?per_page=100&page=1&ts=1000000');
    });
  });
});