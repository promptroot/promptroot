import { describe, it, expect, beforeEach } from 'vitest';
import { showToast } from '../../modules/toast.js';

describe('Toast Module', () => {
  beforeEach(() => {
    // Clear any existing toasts but keep the body structure
    const container = document.querySelector('.toast-container');
    if (container) {
      container.innerHTML = '';
    }
  });

  it('should create toast element with message', () => {
    showToast('Test message', 'info');
    
    const toast = document.querySelector('[class*="toast--"]');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Test message');
  });

  it('should apply correct style class', () => {
    showToast('Success', 'success');
    const successToast = document.querySelector('.toast--success');
    expect(successToast).toBeTruthy();
    expect(successToast.classList.contains('toast--success')).toBe(true);
  });

  it('should have close button', () => {
    showToast('Closeable', 'info');
    
    const toast = document.querySelector('[class*="toast--"]');
    const closeBtn = toast.querySelector('button');
    
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.className).toBe('toast__close');
  });

  it('should stack multiple toasts', () => {
    showToast('First', 'info');
    showToast('Second', 'success');
    showToast('Third', 'error');
    
    const toasts = document.querySelectorAll('[class*="toast--"]');
    expect(toasts.length).toBe(3);
  });

  it('should contain icon and message elements', () => {
    showToast('Test', 'success');
    
    const toast = document.querySelector('.toast--success');
    const icon = toast.querySelector('.toast__icon');
    const message = toast.querySelector('.toast__message');
    
    expect(icon).toBeTruthy();
    expect(message).toBeTruthy();
    expect(message.textContent).toBe('Test');
  });
});
