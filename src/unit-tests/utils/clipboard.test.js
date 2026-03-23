import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyText } from '../../utils/clipboard.js';

describe('Clipboard Utils', () => {
  // Save original globals
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  beforeEach(() => {
    // Reset vi.fn mocks
    vi.clearAllMocks();

    // Mock console methods
    global.console.warn = vi.fn();
    global.console.error = vi.fn();

    // Setup basic document mock for fallback copy
    global.document = {
      createElement: vi.fn(),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn(),
    };
  });

  // Ensure global.navigator is configurable for mocking
  if (!Object.getOwnPropertyDescriptor(global, 'navigator')) {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true
    });
  }

  afterEach(() => {
    // Restore globals
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true
    });
    global.document = originalDocument;
  });

  describe('copyText', () => {
    it('should return false and warn if text is empty', async () => {
      const result = await copyText('');
      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('Clipboard: No text provided to copy.');
    });

    it('should return false and warn if text is null/undefined', async () => {
      const result = await copyText(null);
      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith('Clipboard: No text provided to copy.');
    });

    it('should successfully copy using navigator.clipboard.writeText if available', async () => {
      // Mock navigator.clipboard
      const mockWriteText = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: {
            writeText: mockWriteText
          }
        },
        configurable: true
      });

      const textToCopy = 'test content';
      const result = await copyText(textToCopy);

      expect(mockWriteText).toHaveBeenCalledWith(textToCopy);
      expect(result).toBe(true);
      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('should fallback to execCommand if navigator.clipboard is unavailable', async () => {
      // Setup environment without navigator.clipboard
      Object.defineProperty(global, 'navigator', {
        value: {},
        configurable: true
      });

      // Mock DOM methods for fallback
      const mockTextarea = {
        style: {},
        select: vi.fn()
      };

      document.createElement.mockReturnValue(mockTextarea);
      document.execCommand.mockReturnValue(true);

      const textToCopy = 'fallback content';
      const result = await copyText(textToCopy);

      // Verify DOM operations for fallback
      expect(document.createElement).toHaveBeenCalledWith('textarea');
      expect(mockTextarea.value).toBe(textToCopy);
      expect(mockTextarea.style.position).toBe('fixed');
      expect(mockTextarea.style.opacity).toBe('0');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockTextarea);
      expect(mockTextarea.select).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(document.body.removeChild).toHaveBeenCalledWith(mockTextarea);

      expect(result).toBe(true);
    });

    it('should fallback to execCommand if navigator.clipboard.writeText is unavailable', async () => {
      // Setup environment with navigator.clipboard but no writeText
      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: {} // missing writeText
        },
        configurable: true
      });

      // Mock DOM methods for fallback
      const mockTextarea = {
        style: {},
        select: vi.fn()
      };

      document.createElement.mockReturnValue(mockTextarea);
      document.execCommand.mockReturnValue(true);

      const textToCopy = 'fallback content';
      const result = await copyText(textToCopy);

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(result).toBe(true);
    });

    it('should return false if execCommand fails', async () => {
      // Setup environment without navigator.clipboard
      Object.defineProperty(global, 'navigator', {
        value: {},
        configurable: true
      });

      const mockTextarea = {
        style: {},
        select: vi.fn()
      };

      document.createElement.mockReturnValue(mockTextarea);
      document.execCommand.mockReturnValue(false); // Simulate failure

      const result = await copyText('fail content');

      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(result).toBe(false);
    });

    it('should return false and log error if navigator.clipboard.writeText throws', async () => {
      const error = new Error('Clipboard error');
      const mockWriteText = vi.fn().mockRejectedValue(error);

      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: {
            writeText: mockWriteText
          }
        },
        configurable: true
      });

      const result = await copyText('test content');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Clipboard copy failed:', error);
    });

    it('should return false and log error if fallback throws', async () => {
      // Setup environment without navigator.clipboard
      Object.defineProperty(global, 'navigator', {
        value: {},
        configurable: true
      });

      const error = new Error('DOM Error');
      document.createElement.mockImplementation(() => {
        throw error;
      });

      const result = await copyText('test content');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Clipboard copy failed:', error);
    });
  });
});
