import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleError, ErrorCategory } from '../../utils/error-handler.js';
import * as toastModule from '../../modules/toast.js';
import statusBar from '../../modules/status-bar.js';

// Mock dependencies
vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    showMessage: vi.fn(),
    hide: vi.fn()
  }
}));

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle string errors', () => {
    const result = handleError('Something went wrong');
    expect(result.message).toBe('Something went wrong');
    expect(result.category).toBe(ErrorCategory.UNEXPECTED);
    expect(toastModule.showToast).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'), 'error', undefined);
  });

  it('should handle Error objects', () => {
    const error = new Error('Failed to fetch');
    const result = handleError(error);
    expect(result.message).toBe('Failed to fetch');
    expect(result.category).toBe(ErrorCategory.NETWORK); // Should detect network error
    expect(toastModule.showToast).toHaveBeenCalled();
  });

  it('should use explicit category if provided', () => {
    const error = new Error('Some error');
    const result = handleError(error, {}, { category: ErrorCategory.AUTH });
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.suggestion).toBe('Please sign in again.');
  });

  it('should use statusBar for ASYNC_PROCESS category', () => {
    handleError('Async error', {}, { category: ErrorCategory.ASYNC_PROCESS });
    expect(statusBar.showMessage).toHaveBeenCalled();
    expect(toastModule.showToast).not.toHaveBeenCalled();
  });

  it('should use toast for USER_ACTION category', () => {
    handleError('User action error', {}, { category: ErrorCategory.USER_ACTION });
    expect(toastModule.showToast).toHaveBeenCalled();
    expect(statusBar.showMessage).not.toHaveBeenCalled();
  });

  it('should respect silent option', () => {
    handleError('Silent error', {}, { silent: true });
    expect(toastModule.showToast).not.toHaveBeenCalled();
    expect(statusBar.showMessage).not.toHaveBeenCalled();
  });

  it('should include recovery suggestion in return object and display message', () => {
    const error = new Error('Network error');
    const result = handleError(error, {}, { category: ErrorCategory.NETWORK });

    expect(result.suggestion).toBe('Please check your connection and try again.');
    expect(toastModule.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Please check your connection'),
      'error',
      undefined
    );
  });
});
