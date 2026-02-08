/**
 * Prompt Viewer Modal Module
 * Shared modal for viewing and copying Jules session prompts
 */

import { createElement } from '../utils/dom-helpers.js';
import { showToast } from './toast.js';
import { TIMEOUTS } from '../utils/constants.js';

let currentEscapeHandler = null;
let promptViewerHandlers = new Map();

function createPromptViewerModal() {
  const modal = createElement('div', 'modal modal--prompt-viewer');
  modal.id = 'promptViewerModal';

  const content = createElement('div', 'modal-content modal-xl');

  // Header
  const header = createElement('div', 'modal-header');
  const title = createElement('h3', '', 'Session Prompt');
  title.id = 'promptViewerTitle';

  const closeX = createElement('button', 'btn-icon close-modal', '✕');
  closeX.id = 'promptViewerClose';
  closeX.title = 'Close';

  header.appendChild(title);
  header.appendChild(closeX);

  // Body
  const body = createElement('div', 'modal-body prompt-viewer-body');
  const pre = createElement('pre', 'prompt-viewer-text');
  pre.id = 'promptViewerText';
  body.appendChild(pre);

  // Buttons
  const buttons = createElement('div', 'modal-buttons');

  const copyBtn = createElement('button', 'btn primary');
  copyBtn.id = 'promptViewerCopy';
  const icon = createElement('span', 'icon icon-inline', 'content_copy');
  icon.setAttribute('aria-hidden', 'true');
  copyBtn.appendChild(icon);
  copyBtn.append(' Copy Prompt');

  const closeBtn = createElement('button', 'btn', 'Close');
  closeBtn.id = 'promptViewerCloseBtn';

  buttons.appendChild(copyBtn);
  buttons.appendChild(closeBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(buttons);

  modal.appendChild(content);
  document.body.appendChild(modal);
  return modal;
}

export function showPromptViewer(prompt, sessionId) {
  let modal = document.getElementById('promptViewerModal');
  if (!modal) {
    modal = createPromptViewerModal();
  }
  
  const promptText = document.getElementById('promptViewerText');
  const copyBtn = document.getElementById('promptViewerCopy');
  const closeBtn = document.getElementById('promptViewerCloseBtn');
  const closeX = document.getElementById('promptViewerClose');
  
  promptText.textContent = prompt || 'No prompt text available';
  
  // Copy functionality
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check</span> Copied!';
      copyBtn.disabled = true;
      showToast('Prompt copied to clipboard', 'success');
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.disabled = false;
      }, TIMEOUTS.actionFeedback);
    } catch (err) {
      console.error('Copy failed:', err);
      showToast('Failed to copy prompt to clipboard', 'error');
    }
  };
  
  // Close functionality
  const closeModal = () => {
    modal.classList.remove('show');
  };
  
  // Remove old listeners and add new ones
  const newCopyBtn = copyBtn.cloneNode(true);
  const newCloseBtn = closeBtn.cloneNode(true);
  const newCloseX = closeX.cloneNode(true);
  
  copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  closeX.parentNode.replaceChild(newCloseX, closeX);
  
  newCopyBtn.addEventListener('click', handleCopy);
  newCloseBtn.addEventListener('click', closeModal);
  newCloseX.addEventListener('click', closeModal);
  
  // Close on background click - clear previous handler first
  modal.onclick = null;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  // Close on Escape key - remove any existing handler first
  if (currentEscapeHandler) {
    document.removeEventListener('keydown', currentEscapeHandler);
  }
  currentEscapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', currentEscapeHandler);
      currentEscapeHandler = null;
    }
  };
  document.addEventListener('keydown', currentEscapeHandler);
  
  modal.classList.add('show');
  
  // Focus the copy button
  setTimeout(() => newCopyBtn.focus(), TIMEOUTS.modalFocus);
}

/**
 * Clean up old prompt viewer handlers and attach new ones
 * @param {Array} sessions - Array of session objects with prompt data
 */
export function attachPromptViewerHandlers(sessions) {
  // Clean up old handlers to prevent memory leaks
  promptViewerHandlers.forEach((handler, key) => {
    delete window[key];
  });
  promptViewerHandlers.clear();
  
  // Attach new handlers
  sessions.forEach(session => {
    const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
    const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');
    const handlerKey = `viewPrompt_${cleanId}`;
    const handler = () => showPromptViewer(session.prompt || 'No prompt text available', sessionId);
    window[handlerKey] = handler;
    promptViewerHandlers.set(handlerKey, handler);
  });
}
