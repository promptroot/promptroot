import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clearCopenCache, copyAndOpen } from '../../modules/copen.js';
import { showToast } from '../../modules/toast.js';
import { copyText } from '../../utils/clipboard.js';
import { getUserCopens } from '../../modules/copen-manager.js';
import { getAuth } from '../../modules/firebase-service.js';
import { clearCopenOptionsCache } from '../../utils/copen-config.js';

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../utils/clipboard.js', () => ({
  copyText: vi.fn(() => Promise.resolve())
}));

vi.mock('../../modules/copen-manager.js', () => ({
  getUserCopens: vi.fn(() => Promise.resolve([
    { id: 'claude', url: 'https://claude.ai' },
    { id: 'chatgpt', url: 'https://chat.openai.com' }
  ]))
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'user123' }
  }))
}));

vi.mock('../../utils/copen-config.js', () => ({
  clearCopenOptionsCache: vi.fn()
}));

describe('copen module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.open
    global.window.open = vi.fn();
    // Clear the cache before each test by calling the function we're testing
    // because copenCache is a module-level variable.
    clearCopenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('clearCopenCache', () => {
    it('should call clearCopenOptionsCache', () => {
      clearCopenCache();
      expect(clearCopenOptionsCache).toHaveBeenCalled();
    });
  });

  describe('copyAndOpen', () => {
    it('should copy text and open URL', async () => {
      const result = await copyAndOpen('claude', 'Hello Claude');

      expect(result).toBe(true);
      expect(copyText).toHaveBeenCalledWith('Hello Claude');
      expect(getUserCopens).toHaveBeenCalledWith('user123');
      expect(global.window.open).toHaveBeenCalledWith('https://claude.ai', '_blank', 'noopener,noreferrer');
    });

    it('should use "about:blank" if target not found', async () => {
      const result = await copyAndOpen('unknown', 'Hello');

      expect(result).toBe(true);
      expect(global.window.open).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer');
    });

    it('should show toast and return false if promptText is missing', async () => {
      const result = await copyAndOpen('claude', '');

      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith('No prompt available.', 'warn');
      expect(copyText).not.toHaveBeenCalled();
    });

    it('should handle copy errors', async () => {
      copyText.mockRejectedValueOnce(new Error('Copy failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await copyAndOpen('claude', 'Hello');

      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith('Clipboard blocked. Could not copy prompt.', 'warn');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should cache copens and not call getUserCopens repeatedly', async () => {
      await copyAndOpen('claude', 'Hello 1');
      await copyAndOpen('chatgpt', 'Hello 2');

      expect(getUserCopens).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after clearCopenCache is called', async () => {
      await copyAndOpen('claude', 'Hello 1');
      expect(getUserCopens).toHaveBeenCalledTimes(1);

      clearCopenCache();

      await copyAndOpen('claude', 'Hello 2');
      expect(getUserCopens).toHaveBeenCalledTimes(2);
    });
  });
});
