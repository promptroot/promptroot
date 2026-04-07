import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isChromium, detectExtension } from '../../utils/extension-detector.js';

describe('extension-detector', () => {
  const originalChrome = window.chrome;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    // Restore originals
    window.chrome = originalChrome;
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
      writable: true
    });

    // Clean up DOM
    document.documentElement.removeAttribute('data-promptroot-extension');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('isChromium', () => {
    it('should return true if window.chrome exists', () => {
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      });
      expect(isChromium()).toBe(true);
    });

    it('should return true if Edge is detected via userAgent', () => {
      window.chrome = undefined;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        configurable: true
      });
      expect(isChromium()).toBe(true);
    });

    it('should return true if Brave is detected via userAgent', () => {
      window.chrome = undefined;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Brave/91.0.4472.124',
        configurable: true
      });
      expect(isChromium()).toBe(true);
    });

    it('should return false for Firefox', () => {
      window.chrome = undefined;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        configurable: true
      });
      expect(isChromium()).toBe(false);
    });

    it('should return false for Safari (non-Chrome)', () => {
      window.chrome = undefined;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        configurable: true
      });
      expect(isChromium()).toBe(false);
    });
  });

  describe('detectExtension', () => {
    it('should return false immediately if not Chromium', async () => {
      window.chrome = undefined;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        configurable: true
      });
      const result = await detectExtension();
      expect(result).toBe(false);
    });

    it('should return true if marker is already present', async () => {
      window.chrome = { runtime: {} };
      document.documentElement.setAttribute('data-promptroot-extension', 'true');
      const result = await detectExtension();
      expect(result).toBe(true);
    });

    it('should return true if marker is added within timeout', async () => {
      vi.useFakeTimers();
      window.chrome = { runtime: {} };

      const detectPromise = detectExtension();

      // Simulate marker addition
      document.documentElement.setAttribute('data-promptroot-extension', 'true');

      // We need to trigger the MutationObserver. JSDOM usually does this automatically
      // when attributes change.

      const result = await detectPromise;
      expect(result).toBe(true);
    });

    it('should return false if timeout is reached without marker', async () => {
      vi.useFakeTimers();
      window.chrome = { runtime: {} };

      const detectPromise = detectExtension();

      // Fast forward past 300ms
      vi.advanceTimersByTime(301);

      const result = await detectPromise;
      expect(result).toBe(false);
    });

    it('should return true if marker is added just before timeout', async () => {
      vi.useFakeTimers();
      window.chrome = { runtime: {} };

      const detectPromise = detectExtension();

      vi.advanceTimersByTime(250);
      document.documentElement.setAttribute('data-promptroot-extension', 'true');

      const result = await detectPromise;
      expect(result).toBe(true);
    });
  });
});
