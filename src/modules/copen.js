import { showToast } from './toast.js';
import { copyText } from '../utils/clipboard.js';
import { getUserCopens } from './copen-manager.js';
import { getAuth } from './firebase-service.js';
import { clearCopenOptionsCache } from '../utils/copen-config.js';

// Cache for user copens
let copenCache = null;

/**
 * Get URL for a copen target
 * @param {string} target - The copen ID
 * @returns {Promise<string>} - The URL
 */
async function getCopenUrl(target) {
  if (!copenCache) {
    const auth = getAuth();
    const user = auth?.currentUser;
    const copens = await getUserCopens(user?.uid);
    copenCache = Object.fromEntries(copens.map(c => [c.id, c.url]));
  }

  return copenCache[target] || 'about:blank';
}

/**
 * Clear the copen cache (call when user signs out or copens are updated)
 */
export function clearCopenCache() {
  copenCache = null;
  clearCopenOptionsCache(); // Also clear the memory cache
}

/**
 * Copies the prompt text to clipboard and opens the target URL in a new tab.
 * @param {string} target - The key for the target application (e.g., 'claude', 'chatgpt').
 * @param {string} promptText - The text to copy to clipboard.
 * @returns {Promise<boolean>} - Resolves to true if successful, false otherwise.
 */
export async function copyAndOpen(target, promptText) {
  if (!promptText) {
    showToast('No prompt available.', 'warn');
    return false;
  }

  try {
    await copyText(promptText);

    let url = await getCopenUrl(target);
    if (url.includes('{prompt}')) {
      url = url.replace('{prompt}', encodeURIComponent(promptText));
    }

    // Validate URL protocol to prevent XSS / Open Redirect
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'opencode:') {
        console.error('Invalid Copen URL protocol:', parsedUrl.protocol);
        showToast('Invalid Copen URL.', 'error');
        return false;
      }
    } catch (e) {
      console.error('Invalid Copen URL:', url);
      showToast('Invalid Copen URL.', 'error');
      return false;
    }

    window.open(url, '_blank', 'noopener,noreferrer');

    return true;
  } catch (error) {
    console.error('Copen error:', error);
    showToast('Clipboard blocked. Could not copy prompt.', 'warn');
    return false;
  }
}
