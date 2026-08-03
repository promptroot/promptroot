/**
 * Copen Options Configuration
 * Dynamically loads copen options from user configuration
 */

import { getUserCopens } from '../modules/copen-manager.js';
import { getAuth } from '../modules/firebase-service.js';

// Static options for initialization
export const COPEN_OPTIONS_STATIC = [
  { value: 'allhands', label: 'All Hands', icon: 'front_hand' },
  { value: 'claude', label: 'Claude', icon: 'smart_toy' },
  { value: 'codex', label: 'Codex', icon: 'forum' },
  { value: 'copilot', label: 'Copilot', icon: 'code' },
  { value: 'qwen', label: 'Qwen', icon: 'terminal' },
  { value: 'blank', label: 'Blank', icon: 'public' },
  { value: 'gemini', label: 'Gemini', icon: 'auto_awesome' },
  { value: 'chatgpt', label: 'ChatGPT', icon: 'chat' }
];

// For backward compatibility
export const COPEN_OPTIONS = COPEN_OPTIONS_STATIC;

export const COPEN_STORAGE_KEY = 'copen-last-selection';
export const COPEN_DEFAULT_LABEL = 'Copen';
export const COPEN_DEFAULT_ICON = 'open_in_new';

// In-memory cache for copen options
let _copenOptionsCache = null;
let _copenOptionsCacheUserId = null;

/**
 * Clear the in-memory copen options cache
 */
export function clearCopenOptionsCache() {
  _copenOptionsCache = null;
  _copenOptionsCacheUserId = null;
}

/**
 * Get copen options for the current user
 * @returns {Promise<Array>} Array of copen options
 */
export async function getCopenOptions() {
  const auth = getAuth();
  const user = auth?.currentUser;
  const userId = user?.uid;
  
  // Return cached options if user hasn't changed
  if (_copenOptionsCache && _copenOptionsCacheUserId === userId) {
    return _copenOptionsCache;
  }
  
  const copens = await getUserCopens(userId);
  
  // Convert to the format expected by split-button
  const options = copens
    .filter(c => !c.disabled)
    .map(c => ({
      value: c.id,
      label: c.label,
      icon: c.icon
    }));
  
  // Cache the result
  _copenOptionsCache = options;
  _copenOptionsCacheUserId = userId;
  
  return options;
}
