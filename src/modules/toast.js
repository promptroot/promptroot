/**
 * Toast Notification System
 * Provides elegant, non-blocking notifications to replace alert() calls
 * 
 * Usage:
 *   import { showToast } from './toast.js';
 *   showToast('Message here', 'success'); // or 'error', 'info', 'warn'
 */

import { TIMEOUTS } from '../utils/constants.js';

let toastContainer = null;

/**
 * Initialize toast container on first use
 */
function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'warn', 'info'
 * @param {number} duration - Duration in ms (default: 4000)
 */
export function showToast(message, type = 'info', duration = TIMEOUTS.toast) {
  const container = ensureContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  
  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.textContent = getIcon(type);
  
  const messageEl = document.createElement('span');
  messageEl.className = 'toast__message';
  messageEl.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close';
  closeBtn.textContent = '×';
  closeBtn.onclick = () => removeToast(toast);
  
  toast.appendChild(icon);
  toast.appendChild(messageEl);
  toast.appendChild(closeBtn);
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast--show');
  });
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
  
  return toast;
}

/**
 * Remove a toast with animation
 */
function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  
  toast.classList.remove('toast--show');
  toast.classList.add('toast--hide');
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

/**
 * Get icon for toast type
 */
function getIcon(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error': return '✗';
    case 'warn': return '⚠';
    case 'info': return 'ⓘ';
    default: return 'ⓘ';
  }
}

/**
 * Convenience methods for specific toast types
 */
export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  warn: (message, duration) => showToast(message, 'warn', duration),
  info: (message, duration) => showToast(message, 'info', duration)
};
