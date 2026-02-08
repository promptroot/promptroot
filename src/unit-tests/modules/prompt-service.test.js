import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { loadPrompts, getPromptFolder } from '../../modules/prompt-service.js';

// Mock dependencies
vi.mock('../../modules/github-api.js', () => ({
  listPromptsViaContents: vi.fn(),
  listPromptsViaTrees: vi.fn(),
  getRateLimitInfo: vi.fn(() => ({ remaining: 100, limit: 5000, reset: Date.now() + 3600000, lastUpdated: Date.now() }))
}));

vi.mock('../../utils/cache-manager.js', () => ({
  recordCacheAccess: vi.fn(),
  enforceCacheLimit: vi.fn()
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    showMessage: vi.fn(),
    clear: vi.fn(),
    showRateLimitWarning: vi.fn()
  }
}));

global.sessionStorage = {
  getItem: vi.fn((key) => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

global.console = {
  error: vi.fn(),
  warn: vi.fn()
};

function mockReset() {
  vi.clearAllMocks();
  global.sessionStorage.getItem.mockReturnValue(null);
}

describe('prompt-service', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('getPromptFolder', () => {
    it('should return webcaptures for web-captures branch', () => {
      expect(getPromptFolder('web-captures')).toBe('webcaptures');
    });
    it('should return prompts for other branches', () => {
      expect(getPromptFolder('main')).toBe('prompts');
      expect(getPromptFolder('dev')).toBe('prompts');
    });
  });

  describe('loadPrompts', () => {
    it('should load list using trees API and cache it', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [{ type: 'file', path: 'prompts/test.md', name: 'test.md' }];

      githubApi.listPromptsViaTrees.mockResolvedValue({
        files: mockFiles,
        etag: 'test-etag'
      });

      const files = await loadPrompts('owner', 'repo', 'main', 'cache-key');

      expect(files).toEqual(mockFiles);
      expect(githubApi.listPromptsViaTrees).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts', null);
      expect(global.sessionStorage.setItem).toHaveBeenCalled();
    });

    it('should return cached data immediately', async () => {
      const cachedData = {
        files: [{ type: 'file', path: 'cached.md' }],
        etag: 'cached-etag',
        timestamp: Date.now()
      };
      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(cachedData));

      const files = await loadPrompts('owner', 'repo', 'main', 'cache-key');
      expect(files).toEqual(cachedData.files);
    });

    it('should refresh in background if cache is stale', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const cachedFiles = [{ type: 'file', path: 'old.md' }];
      const newFiles = [{ type: 'file', path: 'new.md' }];

      const cachedData = {
        files: cachedFiles,
        etag: 'old-etag',
        timestamp: Date.now() - (16 * 60 * 1000) // 16 mins old
      };

      global.sessionStorage.getItem.mockReturnValue(JSON.stringify(cachedData));

      githubApi.listPromptsViaTrees.mockResolvedValue({
        files: newFiles,
        etag: 'new-etag'
      });

      const onUpdate = vi.fn();
      const files = await loadPrompts('owner', 'repo', 'main', 'cache-key', onUpdate);

      // Should return cached files immediately
      expect(files).toEqual(cachedFiles);

      // Wait for background promise to complete using Testing Library's waitFor
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(newFiles);
      }, { timeout: 1000 });

      expect(githubApi.listPromptsViaTrees).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts', 'old-etag');
    });

    it('should fallback to contents API if trees fails', async () => {
      const githubApi = await import('../../modules/github-api.js');
      const mockFiles = [{ type: 'file', path: 'prompts/test.md', name: 'test.md' }];

      githubApi.listPromptsViaTrees.mockRejectedValue(new Error('Trees API failed'));
      githubApi.listPromptsViaContents.mockResolvedValue(mockFiles);

      const files = await loadPrompts('owner', 'repo', 'main', 'cache-key');

      expect(files).toEqual(mockFiles);
      expect(githubApi.listPromptsViaContents).toHaveBeenCalledWith('owner', 'repo', 'main', 'prompts');
    });
  });
});
