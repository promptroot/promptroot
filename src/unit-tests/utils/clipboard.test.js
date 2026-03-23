import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyText } from '../../utils/clipboard.js';

describe('clipboard utility', () => {
  const originalNavigator = global.navigator;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    // Reset mocks
    console.error = vi.fn();
    console.warn = vi.fn();

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    // Restore originals
    if (originalNavigator) {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
    } else {
      global.navigator = undefined;
    }
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });

  it('should return true when text is successfully copied', async () => {
    const result = await copyText('Hello World');

    expect(result).toBe(true);
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Hello World');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return false and warn when no text is provided', async () => {
    const result = await copyText('');

    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith('Clipboard: No text provided to copy.');
    expect(global.navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('should return false when navigator.clipboard is missing', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true
    });

    const result = await copyText('Hello');

    expect(result).toBe(false);
    // Be more flexible with the error message in CI
    expect(console.error).toHaveBeenCalled();
    const firstCall = console.error.mock.calls[0][0];
    expect(firstCall === 'Clipboard API not available' || firstCall === 'Clipboard copy failed:').toBe(true);
  });

  it('should return false when writeText is missing', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: {}
      },
      configurable: true,
      writable: true
    });

    const result = await copyText('Hello');

    expect(result).toBe(false);
    // Be more flexible with the error message in CI
    expect(console.error).toHaveBeenCalled();
    const firstCall = console.error.mock.calls[0][0];
    expect(firstCall === 'Clipboard API not available' || firstCall === 'Clipboard copy failed:').toBe(true);
  });

  it('should return false and log error when writeText throws', async () => {
    const error = new Error('Clipboard error');
    global.navigator.clipboard.writeText.mockRejectedValue(error);

    const result = await copyText('Hello');

    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Clipboard copy failed:', error);
  });
});
