import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast, toast } from '../../modules/toast.js';
import { TIMEOUTS } from '../../utils/constants.js';

describe('toast', () => {
  beforeEach(() => {
    // Clear any existing toasts but preserve the container and module state like integration tests
    const container = document.querySelector('.toast-container');
    if (container) {
      container.innerHTML = '';
    }
    
    vi.useFakeTimers();
    
    // Mock requestAnimationFrame to execute immediately
    global.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
  });

  afterEach(() => {
    // Only clean up timers, preserve DOM state between tests
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('container creation', () => {
    it('should create toast container on first toast', () => {
      showToast('Test message');
      
      const container = document.querySelector('.toast-container');
      expect(container).toBeTruthy();
      expect(container.parentElement).toBe(document.body);
    });

    it('should reuse existing container for multiple toasts', () => {
      showToast('First toast');
      showToast('Second toast');
      
      const containers = document.querySelectorAll('.toast-container');
      expect(containers.length).toBe(1);
      
      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(2);
    });
  });

  describe('basic toast creation', () => {
    it('should create toast with correct structure', () => {
      const toast = showToast('Test message');
      
      expect(toast.className).toBe('toast toast--info toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      const message = toast.querySelector('.toast__message');
      const closeBtn = toast.querySelector('.toast__close');
      
      expect(icon).toBeTruthy();
      expect(message).toBeTruthy();
      expect(closeBtn).toBeTruthy();
      
      expect(message.textContent).toBe('Test message');
      expect(closeBtn.textContent).toBe('×');
    });

    it('should use info type by default', () => {
      const toast = showToast('Default toast');
      
      expect(toast.className).toBe('toast toast--info toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('ⓘ');
    });

    it('should use default timeout from constants', () => {
      showToast('Timed toast');
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      
      // Advance time just before timeout
      vi.advanceTimersByTime(TIMEOUTS.toast - 100);
      expect(document.querySelector('.toast')).toBeTruthy();
      
      // Advance past timeout
      vi.advanceTimersByTime(200);
      expect(document.querySelector('.toast')).toBeTruthy(); // Still there due to removal animation
      
      // Complete removal animation
      vi.advanceTimersByTime(300);
      expect(document.querySelector('.toast')).toBeFalsy();
    });
  });

  describe('toast types and icons', () => {
    it('should create success toast with correct icon', () => {
      const toast = showToast('Success!', 'success');
      
      expect(toast.className).toBe('toast toast--success toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('✓');
    });

    it('should create error toast with correct icon', () => {
      const toast = showToast('Error!', 'error');
      
      expect(toast.className).toBe('toast toast--error toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('✗');
    });

    it('should create warning toast with correct icon', () => {
      const toast = showToast('Warning!', 'warn');
      
      expect(toast.className).toBe('toast toast--warn toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('⚠');
    });

    it('should create info toast with correct icon', () => {
      const toast = showToast('Info!', 'info');
      
      expect(toast.className).toBe('toast toast--info toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('ⓘ');
    });

    it('should default to info icon for unknown types', () => {
      const toast = showToast('Unknown type', 'unknown');
      
      expect(toast.className).toBe('toast toast--unknown toast--show');
      
      const icon = toast.querySelector('.toast__icon');
      expect(icon.textContent).toBe('ⓘ');
    });
  });

  describe('custom duration', () => {
    it('should respect custom duration', () => {
      const customDuration = 2000;
      showToast('Custom duration toast', 'info', customDuration);
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      
      // Advance time just before custom timeout
      vi.advanceTimersByTime(customDuration - 100);
      expect(document.querySelector('.toast')).toBeTruthy();
      
      // Advance past custom timeout
      vi.advanceTimersByTime(200);
      expect(document.querySelector('.toast')).toBeTruthy(); // Still there due to animation
      
      // Complete removal animation
      vi.advanceTimersByTime(300);
      expect(document.querySelector('.toast')).toBeFalsy();
    });

    it('should not auto-remove when duration is 0', () => {
      showToast('Persistent toast', 'info', 0);
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      
      // Advance time well beyond normal timeout
      vi.advanceTimersByTime(TIMEOUTS.toast + 1000);
      
      // Toast should still be there
      expect(document.querySelector('.toast')).toBeTruthy();
    });

    it('should not auto-remove when duration is negative', () => {
      showToast('Persistent toast', 'info', -1);
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      
      // Advance time well beyond normal timeout
      vi.advanceTimersByTime(TIMEOUTS.toast + 1000);
      
      // Toast should still be there
      expect(document.querySelector('.toast')).toBeTruthy();
    });
  });

  describe('animation and display', () => {
    it('should add show class after requestAnimationFrame', () => {
      const toast = showToast('Animated toast');
      
      // Since requestAnimationFrame is mocked to execute immediately, show class should be added
      expect(toast.classList.contains('toast--show')).toBe(true);
    });

    it('should add toast to container in DOM', () => {
      showToast('Container test');
      
      const container = document.querySelector('.toast-container');
      const toast = container.querySelector('.toast');
      
      expect(toast).toBeTruthy();
      expect(toast.parentElement).toBe(container);
    });
  });

  describe('manual removal via close button', () => {
    it('should remove toast when close button is clicked', () => {
      showToast('Closeable toast');
      
      const toast = document.querySelector('.toast');
      const closeBtn = toast.querySelector('.toast__close');
      
      expect(toast).toBeTruthy();
      
      // Click close button
      closeBtn.click();
      
      // Should add hide class and remove show class
      expect(toast.classList.contains('toast--show')).toBe(false);
      expect(toast.classList.contains('toast--hide')).toBe(true);
      
      // Complete removal animation
      vi.advanceTimersByTime(300);
      
      expect(document.querySelector('.toast')).toBeFalsy();
    });

    it('should handle close button click on already removed toast', () => {
      showToast('Test toast');
      
      const toast = document.querySelector('.toast');
      const closeBtn = toast.querySelector('.toast__close');
      
      // Manually remove toast from DOM
      toast.remove();
      
      // Should not throw error when clicking close button
      expect(() => closeBtn.click()).not.toThrow();
    });
  });

  describe('multiple toasts', () => {
    it('should handle multiple toasts simultaneously', () => {
      showToast('First toast', 'success');
      showToast('Second toast', 'error');
      showToast('Third toast', 'warn');
      
      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(3);
      
      expect(toasts[0].className).toBe('toast toast--success toast--show');
      expect(toasts[1].className).toBe('toast toast--error toast--show');
      expect(toasts[2].className).toBe('toast toast--warn toast--show');
    });

    it('should remove toasts independently', () => {
      showToast('Short toast', 'success', 1000);
      showToast('Long toast', 'info', 3000);
      
      let toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(2);
      
      // Advance time to remove first toast
      vi.advanceTimersByTime(1200); // 1000 + 200 buffer
      
      // Still have toasts due to removal animation
      toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(2);
      
      // Complete first toast removal animation
      vi.advanceTimersByTime(300);
      
      toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(1);
      
      // Check remaining toast is the long one
      expect(toasts[0].className).toBe('toast toast--info toast--show');
    });
  });

  describe('convenience methods', () => {
    it('should provide toast.success method', () => {
      const result = toast.success('Success message');
      
      expect(result.className).toBe('toast toast--success toast--show');
      
      const message = result.querySelector('.toast__message');
      expect(message.textContent).toBe('Success message');
    });

    it('should provide toast.error method', () => {
      const result = toast.error('Error message');
      
      expect(result.className).toBe('toast toast--error toast--show');
      
      const message = result.querySelector('.toast__message');
      expect(message.textContent).toBe('Error message');
    });

    it('should provide toast.warn method', () => {
      const result = toast.warn('Warning message');
      
      expect(result.className).toBe('toast toast--warn toast--show');
      
      const message = result.querySelector('.toast__message');
      expect(message.textContent).toBe('Warning message');
    });

    it('should provide toast.info method', () => {
      const result = toast.info('Info message');
      
      expect(result.className).toBe('toast toast--info toast--show');
      
      const message = result.querySelector('.toast__message');
      expect(message.textContent).toBe('Info message');
    });

    it('should accept custom duration in convenience methods', () => {
      toast.success('Custom duration success', 2000);
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement).toBeTruthy();
      
      // Should not be removed before custom duration
      vi.advanceTimersByTime(1500);
      expect(document.querySelector('.toast')).toBeTruthy();
      
      // Should be removed after custom duration + animation
      vi.advanceTimersByTime(800);
      expect(document.querySelector('.toast')).toBeFalsy();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty message', () => {
      const toast = showToast('');
      
      const message = toast.querySelector('.toast__message');
      expect(message.textContent).toBe('');
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const toast = showToast(longMessage);
      
      const message = toast.querySelector('.toast__message');
      expect(message.textContent).toBe(longMessage);
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Special chars: <>&"\'\\n\\t';
      const toast = showToast(specialMessage);
      
      const message = toast.querySelector('.toast__message');
      expect(message.textContent).toBe(specialMessage);
    });

    it('should handle rapid successive calls', () => {
      // Create many toasts quickly
      for (let i = 0; i < 10; i++) {
        showToast(`Toast ${i}`, 'info');
      }
      
      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(10);
      
      // Each should have correct message
      toasts.forEach((toast, index) => {
        const message = toast.querySelector('.toast__message');
        expect(message.textContent).toBe(`Toast ${index}`);
      });
    });
  });

  describe('DOM cleanup and memory management', () => {
    it('should properly remove toast elements from DOM', () => {
      showToast('Cleanup test');
      
      expect(document.querySelector('.toast')).toBeTruthy();
      
      // Auto-remove after timeout
      vi.advanceTimersByTime(TIMEOUTS.toast + 300);
      
      expect(document.querySelector('.toast')).toBeFalsy();
      expect(document.querySelector('.toast-container').children.length).toBe(0);
    });

    it('should maintain container even after all toasts are removed', () => {
      showToast('Container persistence test');
      
      // Remove toast
      vi.advanceTimersByTime(TIMEOUTS.toast + 300);
      
      // Container should still exist
      expect(document.querySelector('.toast-container')).toBeTruthy();
    });

    it('should handle removal of toast that is already being removed', () => {
      showToast('Double removal test');
      
      const toast = document.querySelector('.toast');
      const closeBtn = toast.querySelector('.toast__close');
      
      // Start removal process
      closeBtn.click();
      
      // Try to remove again - should not throw error
      expect(() => closeBtn.click()).not.toThrow();
      
      // Complete animation
      vi.advanceTimersByTime(300);
      
      expect(document.querySelector('.toast')).toBeFalsy();
    });
  });

  describe('integration and real-world scenarios', () => {
    it('should handle typical success workflow', () => {
      // Simulate successful action
      toast.success('File saved successfully!');
      
      const toastElement = document.querySelector('.toast--success');
      expect(toastElement).toBeTruthy();
      
      const message = toastElement.querySelector('.toast__message');
      expect(message.textContent).toBe('File saved successfully!');
      
      const icon = toastElement.querySelector('.toast__icon');
      expect(icon.textContent).toBe('✓');
    });

    it('should handle typical error workflow', () => {
      // Simulate error action
      toast.error('Failed to save file. Please try again.');
      
      const toastElement = document.querySelector('.toast--error');
      expect(toastElement).toBeTruthy();
      
      const message = toastElement.querySelector('.toast__message');
      expect(message.textContent).toBe('Failed to save file. Please try again.');
      
      const icon = toastElement.querySelector('.toast__icon');
      expect(icon.textContent).toBe('✗');
    });

    it('should handle mixed toast types in sequence', () => {
      // Simulate a sequence of events
      toast.info('Loading file...');
      toast.warn('File is large, this may take a while...');
      toast.error('Connection lost, retrying...');
      toast.success('File loaded successfully!');
      
      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(4);
      
      expect(toasts[0].className).toBe('toast toast--info toast--show');
      expect(toasts[1].className).toBe('toast toast--warn toast--show');
      expect(toasts[2].className).toBe('toast toast--error toast--show');
      expect(toasts[3].className).toBe('toast toast--success toast--show');
    });
  });
});