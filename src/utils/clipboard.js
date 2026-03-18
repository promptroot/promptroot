/**
 * Clipboard utilities
 */

/**
 * Copies text to the clipboard safely and robustly.
 * Handles errors and returns a success boolean.
 *
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} - True if copy was successful, false otherwise.
 */
export async function copyText(text) {
  if (!text) {
    console.warn('Clipboard: No text provided to copy.');
    return false;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for non-secure contexts (http://)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;

  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
}
