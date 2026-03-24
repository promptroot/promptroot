import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { copyText } from '../../utils/clipboard.js';

describe('Clipboard Utilities', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.warn and console.error to keep test output clean
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true
    });
    document.execCommand = originalExecCommand;
  });

  it('should return false and warn if no text is provided', async () => {
    const result = await copyText('');
    expect(result).toBe(false);
    expect(console.warn).toHaveBeenCalledWith('Clipboard: No text provided to copy.');
  });

  it('should use navigator.clipboard.writeText when available', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true
    });

    const result = await copyText('test text');

    expect(result).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith('test text');
  });

  it('should use document.execCommand fallback when navigator.clipboard is unavailable', async () => {
    // Disable navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });

    const mockExecCommand = vi.fn().mockReturnValue(true);
    document.execCommand = mockExecCommand;

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    const result = await copyText('fallback text');

    expect(result).toBe(true);
    expect(mockExecCommand).toHaveBeenCalledWith('copy');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Verify that a textarea was created with the correct value
    const textarea = appendChildSpy.mock.calls[0][0];
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('fallback text');
  });

  it('should use document.execCommand fallback when navigator.clipboard.writeText is unavailable', async () => {
    // navigator.clipboard exists but writeText doesn't
    Object.defineProperty(navigator, 'clipboard', {
      value: {},
      configurable: true
    });

    const mockExecCommand = vi.fn().mockReturnValue(true);
    document.execCommand = mockExecCommand;

    const result = await copyText('fallback text 2');

    expect(result).toBe(true);
    expect(mockExecCommand).toHaveBeenCalledWith('copy');
  });

  it('should return false and log error when navigator.clipboard.writeText throws', async () => {
    const error = new Error('Clipboard error');
    const mockWriteText = vi.fn().mockRejectedValue(error);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true
    });

    const result = await copyText('error text');

    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Clipboard copy failed:', error);
  });

  it('should return false when both navigator.clipboard and execCommand fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });

    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyText('fail text');

    expect(result).toBe(false);
  });
});
