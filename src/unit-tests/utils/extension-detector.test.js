import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isChromium, detectExtension } from '../../utils/extension-detector.js';

describe('extension-detector', () => {
  let originalWindowChrome;
  let originalUserAgent;
  let originalHasAttribute;

  beforeEach(() => {
    // Save original values
    originalWindowChrome = window.chrome;
    originalUserAgent = navigator.userAgent;
    originalHasAttribute = document.documentElement.hasAttribute;

    // Reset window.chrome
    delete window.chrome;

    // Mock navigator.userAgent (which is read-only)
    Object.defineProperty(navigator, 'userAgent', {
      value: '',
      configurable: true,
      writable: true
    });

    // Default documentElement attribute to false
    document.documentElement.hasAttribute = vi.fn().mockReturnValue(false);
  });

  afterEach(() => {
    // Restore original values
    window.chrome = originalWindowChrome;
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
      writable: true
    });
    document.documentElement.hasAttribute = originalHasAttribute;

    vi.restoreAllMocks();
  });

  describe('isChromium()', () => {
    it('returns true when window.chrome is present', () => {
      window.chrome = {};
      expect(isChromium()).toBe(true);
    });

    it('returns true when userAgent contains Edg', () => {
      navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(isChromium()).toBe(true);
    });

    it('returns true when userAgent contains Brave', () => {
      navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120.0.0.0';
      expect(isChromium()).toBe(true);
    });

    it('returns false for non-Chromium browsers', () => {
      navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0';
      expect(isChromium()).toBe(false);
    });
  });

  describe('detectExtension()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false immediately if not a Chromium browser', async () => {
      navigator.userAgent = 'Firefox';
      const result = await detectExtension();
      expect(result).toBe(false);
    });

    it('resolves true immediately if attribute exists on load', async () => {
      window.chrome = {}; // Ensure isChromium() returns true
      document.documentElement.hasAttribute.mockReturnValueOnce(true);

      const result = await detectExtension();
      expect(result).toBe(true);
      expect(document.documentElement.hasAttribute).toHaveBeenCalledWith('data-promptroot-extension');
    });

    it('resolves false after timeout if attribute is never added', async () => {
      window.chrome = {}; // Ensure isChromium() returns true

      const promise = detectExtension();

      // Fast-forward 300ms
      vi.advanceTimersByTime(300);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('resolves true when attribute is added via MutationObserver', async () => {
      window.chrome = {}; // Ensure isChromium() returns true

      // We need to mock MutationObserver
      let observerCallback;
      const mockDisconnect = vi.fn();
      const mockObserve = vi.fn((target, options) => {
        // Just store the callback that was passed to the constructor
        // But the constructor doesn't know about observe, so we have to hack this a bit
      });

      const mockMutationObserver = vi.fn((callback) => {
        observerCallback = callback;
        return {
          observe: mockObserve,
          disconnect: mockDisconnect
        };
      });

      // Save original MutationObserver
      const originalMutationObserver = window.MutationObserver;
      window.MutationObserver = mockMutationObserver;

      const promise = detectExtension();

      // Simulate that the extension loaded and mutated the DOM
      document.documentElement.hasAttribute.mockReturnValueOnce(true);
      if (observerCallback) {
        observerCallback();
      }

      const result = await promise;
      expect(result).toBe(true);
      expect(mockDisconnect).toHaveBeenCalled();

      // Restore MutationObserver
      window.MutationObserver = originalMutationObserver;
    });
  });
});
