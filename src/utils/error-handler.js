/**
 * Unified Error Handler Module
 * Centralizes error handling, logging, and display logic.
 */

import { showToast } from '../modules/toast.js';
import statusBar from '../modules/status-bar.js';
import { TIMEOUTS } from './constants.js';

export const ErrorCategory = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  VALIDATION: 'VALIDATION',
  UNEXPECTED: 'UNEXPECTED',
  ASYNC_PROCESS: 'ASYNC_PROCESS', // For background/long-running tasks
  USER_ACTION: 'USER_ACTION',     // For direct user interactions (clicks, form submits)
  API: 'API'
};

const ERROR_PATTERNS = [
  { pattern: /network|fetch|failed to connect|offline|internet/i, category: ErrorCategory.NETWORK },
  { pattern: /auth|login|sign in|permission|unauthorized|forbidden|token/i, category: ErrorCategory.AUTH },
  { pattern: /validation|invalid|required|missing|format/i, category: ErrorCategory.VALIDATION },
  { pattern: /timeout|timed out/i, category: ErrorCategory.NETWORK }
];

/**
 * Detects the error category based on the error message.
 * @param {Error|string} error
 * @returns {string} ErrorCategory
 */
export function detectCategory(error) {
  if (!error) return ErrorCategory.UNEXPECTED;
  const msg = (typeof error === 'string' ? error : error.message || '').toLowerCase();

  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(msg)) return category;
  }

  return ErrorCategory.UNEXPECTED;
}

/**
 * Returns a recovery suggestion based on the error and category.
 * @param {Error} error
 * @param {string} category
 * @returns {string}
 */
function getRecoverySuggestion(error, category) {
  const msg = (typeof error === 'string' ? error : error.message || '').toLowerCase();

  if (category === ErrorCategory.NETWORK) {
    return 'Please check your connection and try again.';
  }
  if (category === ErrorCategory.AUTH) {
    return 'Please sign in again.';
  }
  if (msg.includes('quota') || msg.includes('limit')) {
    return 'Usage limit exceeded. Try again later.';
  }
  if (category === ErrorCategory.VALIDATION) {
    return 'Please check your input.';
  }

  return '';
}

/**
 * Handles an error by logging it and optionally displaying it to the user.
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Context information (e.g., source: 'MyModule')
 * @param {Object} options - Options for handling
 * @param {string} [options.category] - Explicit error category
 * @param {boolean} [options.showDisplay=true] - Whether to show UI notification
 * @param {boolean} [options.silent=false] - If true, only logs and returns normalized error
 * @param {string} [options.toastType='error'] - Type of toast ('error', 'warn', 'info')
 * @param {number} [options.duration] - Duration for the notification
 * @returns {Object} Normalized error object { message, type, suggestion, category }
 */
export function handleError(error, context = {}, options = {}) {
  const {
    category: explicitCategory,
    showDisplay = true,
    silent = false,
    toastType = 'error',
    duration
  } = options;

  const actualError = typeof error === 'string' ? new Error(error) : error;
  const category = explicitCategory || detectCategory(actualError);

  // Structured logging
  console.error(`[${category}] Error in ${context.source || 'unknown'}:`, {
    message: actualError.message,
    stack: actualError.stack,
    context,
    category
  });

  const message = actualError.message || 'An unknown error occurred';
  const suggestion = getRecoverySuggestion(actualError, category);

  // Construct display message (append suggestion if available and not already part of message)
  const displayMessage = suggestion && !message.includes(suggestion)
    ? `${message} ${suggestion}`
    : message;

  if (!silent && showDisplay) {
    if (category === ErrorCategory.ASYNC_PROCESS) {
      // Async processes use status bar
      // Note: We might want to clear progress or actions if an error occurred during an async process
      statusBar.showMessage(displayMessage, { timeout: duration || TIMEOUTS.longDelay });
    } else {
      // User actions, Network, Auth, Validation, Unexpected use Toast
      // Note: Auth errors might trigger redirects in some apps, but here we just notify.
      showToast(displayMessage, toastType, duration);
    }
  }

  return {
    message,
    type: category,
    category,
    suggestion
  };
}
