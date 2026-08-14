// ===== Prompt Variable Substitution Module =====
// Detects {PLACEHOLDER} variables in prompts and shows modal for user to fill values

import { PLACEHOLDER_REGEX, TIMEOUTS } from '../utils/constants.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';
import { createModal } from '../utils/modal-manager.js';
import { copyAndOpen } from './copen.js';
import { initSplitButton, destroySplitButton } from './split-button.js';
import { getCopenOptions, COPEN_STORAGE_KEY, COPEN_DEFAULT_LABEL, COPEN_DEFAULT_ICON } from '../utils/copen-config.js';
import { showToast } from './toast.js';
import { getCurrentBranch, getCurrentRepo } from './branch-selector.js';
import { copyText } from '../utils/clipboard.js';
import { getLastAgent } from './run-in-agent.js';

let activeVariableModal = null;
let activeCopenButton = null;

function isIncludeFlag(name) {
  return typeof name === 'string' && name.startsWith('INCLUDE_');
}

function formatIncludeFlagLabel(flagName) {
  if (!flagName || typeof flagName !== 'string') {
    return '';
  }

  return flagName
    .replace(/^INCLUDE_/, '')
    .split('_')
    .filter(Boolean)
    .map((word) => {
      if (word === 'UI' || word === 'API' || word === 'E2E') {
        return word;
      }
      return `${word.charAt(0)}${word.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

/**
 * Downloads the provided text as a markdown file
 * @param {string} text - The text content to download
 * @param {string} filename - The filename (without extension)
 */
function downloadAsMarkdown(text, filename = 'prompt') {
  try {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Downloaded successfully', 'success');
  } catch (error) {
    console.error('Download failed:', error);
    showToast('Failed to download file', 'error');
  }
}

/**
 * Opens GitHub UI to save the text as a new file with pre-filled content
 * @param {string} text - The text content to save
 */
function saveToGitHub(text) {
  try {
    const { owner, repo } = getCurrentRepo();
    const branch = getCurrentBranch();
    
    // Generate timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `webclips/customized-prompt-${timestamp}.md`;
    
    // Encode content for URL
    const encodedContent = encodeURIComponent(text);
    
    // Build GitHub URL for creating new file
    const githubUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${filename}&value=${encodedContent}`;
    
    // Open in new tab
    window.open(githubUrl, '_blank');
    showToast('Opening GitHub to save...', 'success');
  } catch (error) {
    console.error('Failed to open GitHub:', error);
    showToast('Failed to open GitHub', 'error');
  }
}

/**
 * Detects placeholders in text matching {WORD} pattern.
 * @param {string} text - The text to scan for placeholders
 * @returns {string[]} Array of unique placeholder names (uppercase)
 */
export function detectPlaceholders(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches = text.matchAll(PLACEHOLDER_REGEX);
  const unique = new Set();
  
  for (const match of matches) {
    unique.add(match[1]); // Capture group = placeholder name
  }
  
  return Array.from(unique);
}

/**
 * Detects conditional include flags in {{#if FLAG_NAME}} blocks.
 * @param {string} text - The template text to scan
 * @returns {string[]} Array of unique include flag names
 */
export function detectConditionalFlags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const regex = /\{\{#if\s+([A-Z0-9_-]+)\}\}/g;
  const matches = text.matchAll(regex);
  const unique = new Set();

  for (const match of matches) {
    unique.add(match[1]);
  }

  return Array.from(unique);
}

/**
 * Renders conditional blocks using boolean values.
 * Unsupported or missing flags evaluate to false.
 * @param {string} text - The template text containing conditional blocks
 * @param {Object} values - Key-value pairs including include flags
 * @returns {string} Text with conditional blocks rendered
 */
export function renderConditionalBlocks(text, values = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const conditionalBlockRegex = /\{\{#if\s+([A-Z0-9_-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return text.replace(conditionalBlockRegex, (fullMatch, flagName, blockContent) => {
    return values[flagName] === true ? blockContent : '';
  });
}

/**
 * Sanitizes user input to prevent XSS attacks.
 * Strips all HTML tags but keeps text content.
 * @param {string} value - The user input value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeInputValue(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  // Ensure DOMPurify is loaded
  if (typeof window.DOMPurify === 'undefined') {
    console.error('DOMPurify not loaded - stripping all HTML tags as safety fallback');
    const div = document.createElement('div');
    div.textContent = value;
    return div.textContent || '';
  }

  // Strip all HTML tags, keep only text content
  return window.DOMPurify.sanitize(value, { 
    ALLOWED_TAGS: [], // Strip all HTML
    KEEP_CONTENT: true // Keep text content
  });
}

/**
 * Collects variable values from form inputs
 * @param {HTMLFormElement} form - The form containing variable inputs
 * @param {string[]} placeholders - Array of placeholder names
 * @param {boolean} useDefaultNA - Whether to use 'N/A' for empty fields (default: false)
 * @returns {Object} Key-value pairs of placeholder names and their values
 */
function getVariableValues(form, textPlaceholders, includeFlags, useDefaultNA = false) {
  const values = {};
  
  if (!form) {
    return values;
  }
  
  (textPlaceholders || []).forEach(placeholder => {
    const input = form.querySelector(`#var_${placeholder}`);
    if (input) {
      const value = input.value.trim();
      if (value) {
        values[placeholder] = value;
      } else if (useDefaultNA) {
        values[placeholder] = 'N/A';
      }
    }
  });

  (includeFlags || []).forEach((flagName) => {
    const checkbox = form.querySelector(`#var_${flagName}`);
    values[flagName] = Boolean(checkbox?.checked);
  });
  
  return values;
}

/**
 * Substitutes placeholders with user-provided values.
 * Values are sanitized to prevent XSS attacks.
 * @param {string} text - The text containing placeholders
 * @param {Object} values - Key-value pairs of placeholder names and their values
 * @returns {string} Text with placeholders replaced
 */
export function substitutePlaceholders(text, values) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;
  
  for (const [key, value] of Object.entries(values)) {
    // Sanitize the value before substitution
    const sanitizedValue = sanitizeInputValue(value);
    const pattern = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(pattern, sanitizedValue);
  }
  
  return result;
}

/**
 * Builds the customization modal DOM structure
 * @param {string[]} placeholders - Array of placeholder names to fill
 * @param {string} promptText - The prompt text for the textarea
 * @returns {HTMLElement} The modal element
 */
function buildVariableModalDOM(textPlaceholders, includeFlags, promptText = '') {
  const modal = createElement('div', 'modal variable-modal');
  modal.id = 'variableModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'variableModalTitle');

  const modalContent = createElement('div', 'modal-content');

  const modalHeader = createElement('div', 'modal-header');
  const title = createElement('h3', '', 'Customize Prompt');
  title.id = 'variableModalTitle';

  const closeBtn = createElement('button', 'btn-icon close-modal', '✕');
  closeBtn.id = 'variableModalClose';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.title = 'Close';

  modalHeader.appendChild(title);
  modalHeader.appendChild(closeBtn);

  const modalBody = createElement('div', 'modal-body');
  
  // Show variables section if there are inputs to render
  if ((textPlaceholders && textPlaceholders.length > 0) || (includeFlags && includeFlags.length > 0)) {
    const variablesSection = createElement('div', 'variable-modal__variables-section');
    
    const varsTitle = createElement('h4', 'variable-modal__section-title', 'Variables');
    variablesSection.appendChild(varsTitle);
    
    const description = createElement('p', 'variable-modal__description', 
      'Fill in the values below and they\'ll be applied to the text:');
    variablesSection.appendChild(description);

    const form = createElement('form', 'variable-modal__form');
    form.id = 'variableForm';

    // Create input field for each text placeholder
    (textPlaceholders || []).forEach(placeholder => {
      const fieldGroup = createElement('div', 'variable-modal__field');
      
      const label = createElement('label', 'variable-modal__label', placeholder);
      label.setAttribute('for', `var_${placeholder}`);
      
      const input = createElement('input', 'variable-modal__input');
      input.type = 'text';
      input.id = `var_${placeholder}`;
      input.name = placeholder;
      input.placeholder = `Enter ${placeholder}...`;
      input.maxLength = 1000;
      
      fieldGroup.appendChild(label);
      fieldGroup.appendChild(input);
      form.appendChild(fieldGroup);
    });

    // Create checkbox field for each INCLUDE_* flag
    (includeFlags || []).forEach((flagName) => {
      const fieldGroup = createElement('div', 'variable-modal__field variable-modal__field--checkbox');

      const checkbox = createElement('input', 'variable-modal__checkbox');
      checkbox.type = 'checkbox';
      checkbox.id = `var_${flagName}`;
      checkbox.name = flagName;

      const label = createElement('label', 'variable-modal__checkbox-label', formatIncludeFlagLabel(flagName));
      label.setAttribute('for', `var_${flagName}`);

      fieldGroup.appendChild(checkbox);
      fieldGroup.appendChild(label);
      form.appendChild(fieldGroup);
    });

    variablesSection.appendChild(form);
    
    // Add "Apply Variables" button
    const applyBtn = createElement('button', 'btn btn-sm', 'Apply to Text');
    applyBtn.id = 'variableModalApply';
    applyBtn.type = 'button';
    variablesSection.appendChild(applyBtn);
    
    modalBody.appendChild(variablesSection);
  }
  
  // Text editor section
  const editorSection = createElement('div', 'variable-modal__editor-section');
  const editorTitle = createElement('h4', 'variable-modal__section-title', 'Edit Text');
  editorSection.appendChild(editorTitle);
  
  const textarea = createElement('textarea', 'variable-modal__textarea');
  textarea.id = 'variableModalTextarea';
  textarea.placeholder = 'Edit your prompt text here...';
  textarea.value = promptText;
  editorSection.appendChild(textarea);
  
  modalBody.appendChild(editorSection);

  const modalButtons = createElement('div', 'modal-buttons variable-modal__actions');
  
  // Cancel button
  const cancelBtn = createElement('button', 'btn', 'Cancel');
  cancelBtn.id = 'variableModalCancel';
  cancelBtn.type = 'button';
  
  // Download button
  const downloadBtn = createElement('button', 'btn');
  downloadBtn.id = 'variableModalDownload';
  downloadBtn.type = 'button';
  const downloadIcon = createIcon('download', 'icon-inline');
  const downloadText = createElement('span', '', 'Download');
  downloadBtn.appendChild(downloadIcon);
  downloadBtn.appendChild(downloadText);

  // Copy button
  const copyBtn = createElement('button', 'btn');
  copyBtn.id = 'variableModalCopy';
  copyBtn.type = 'button';
  const copyIcon = createIcon('content_copy', 'icon-inline');
  const copyTextLabel = createElement('span', '', 'Copy');
  copyBtn.appendChild(copyIcon);
  copyBtn.appendChild(copyTextLabel);

  // Save to GitHub button
  const saveBtn = createElement('button', 'btn');
  saveBtn.id = 'variableModalSave';
  saveBtn.type = 'button';
  const saveIcon = createIcon('cloud_upload', 'icon-inline');
  const saveText = createElement('span', '', 'Save to GitHub');
  saveBtn.appendChild(saveIcon);
  saveBtn.appendChild(saveText);

  // Copen split button container
  const copenContainer = createElement('div', 'split-btn variable-modal__copen-btn');
  copenContainer.id = 'variableModalCopenContainer';
  
  const copenActionBtn = createElement('button', 'split-btn__action btn');
  copenActionBtn.type = 'button';
  
  const copenToggleBtn = createElement('button', 'split-btn__toggle btn');
  copenToggleBtn.type = 'button';
  copenToggleBtn.setAttribute('aria-label', 'Select app');
  copenToggleBtn.setAttribute('aria-haspopup', 'true');
  copenToggleBtn.setAttribute('aria-expanded', 'false');
  
  const copenMenu = createElement('div', 'split-btn__menu');
  copenMenu.setAttribute('role', 'menu');
  
  copenContainer.appendChild(copenActionBtn);
  copenContainer.appendChild(copenToggleBtn);
  copenContainer.appendChild(copenMenu);

  // Continue (Send to agent) button
  const lastAgent = getLastAgent();
  let agentLabel = 'Send to Jules';
  if (lastAgent === 'openhands') {
    agentLabel = 'Send to OpenHands';
  } else if (lastAgent === 'brace') {
    agentLabel = 'Send to Brace';
  }

  const continueBtn = createElement('button', 'btn primary');
  continueBtn.id = 'variableModalContinue';
  continueBtn.type = 'submit';
  const continueIcon = createIcon('send', 'icon-inline');
  const continueText = createElement('span', '', agentLabel);
  continueBtn.appendChild(continueIcon);
  continueBtn.appendChild(continueText);

  modalButtons.appendChild(cancelBtn);
  modalButtons.appendChild(copyBtn);
  modalButtons.appendChild(downloadBtn);
  modalButtons.appendChild(saveBtn);
  modalButtons.appendChild(copenContainer);
  modalButtons.appendChild(continueBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalButtons);

  modal.appendChild(modalContent);
  
  return modal;
}

/**
 * Shows the customization modal with variable inputs and text editor
 * @param {string} promptText - The original prompt text
 * @returns {Promise<void>} Resolves when modal is closed
 */
export function showCustomizeModal(promptText) {
  // Cleanup any existing modal first
  if (activeVariableModal) {
    activeVariableModal.destroy();
    activeVariableModal = null;
  }
  if (activeCopenButton) {
    const existingContainer = document.getElementById('variableModalCopenContainer');
    if (existingContainer) {
      destroySplitButton(existingContainer);
    }
    activeCopenButton = null;
  }

  return new Promise((resolve) => {
    // Detect text placeholders and include flags
    const placeholders = detectPlaceholders(promptText);
    const includeFlagsFromPlaceholders = placeholders.filter(isIncludeFlag);
    const includeFlagsFromConditionals = detectConditionalFlags(promptText).filter(isIncludeFlag);
    const includeFlags = Array.from(new Set([...includeFlagsFromPlaceholders, ...includeFlagsFromConditionals]));
    const textPlaceholders = placeholders.filter((placeholder) => !isIncludeFlag(placeholder));
    
    // Build new DOM element
    const modalElement = buildVariableModalDOM(textPlaceholders, includeFlags, promptText);
    
    // Store active element for focus restoration
    const previouslyFocusedElement = document.activeElement;
    
    const form = modalElement.querySelector('#variableForm');
    const applyBtn = modalElement.querySelector('#variableModalApply');
    const textarea = modalElement.querySelector('#variableModalTextarea');
    const continueBtn = modalElement.querySelector('#variableModalContinue');
    const cancelBtn = modalElement.querySelector('#variableModalCancel');
    const copyBtn = modalElement.querySelector('#variableModalCopy');
    const downloadBtn = modalElement.querySelector('#variableModalDownload');
    const saveBtn = modalElement.querySelector('#variableModalSave');
    const copenContainer = modalElement.querySelector('#variableModalCopenContainer');
    const closeBtn = modalElement.querySelector('#variableModalClose');

    // Create managed modal instance
    const modal = createModal({
      element: modalElement,
      onDestroy: () => {
        activeVariableModal = null;
        // Cleanup copen button
        if (activeCopenButton) {
          destroySplitButton(copenContainer);
          activeCopenButton = null;
        }
        // Restore focus
        if (previouslyFocusedElement &&
            typeof previouslyFocusedElement.focus === 'function' &&
            document.body.contains(previouslyFocusedElement)) {
          setTimeout(() => {
            try {
              previouslyFocusedElement.focus();
            } catch (err) {
              console.warn('Failed to restore focus:', err);
            }
          }, TIMEOUTS.modalFocus);
        }
      }
    });

    activeVariableModal = modal;
    
    // Get current text with variable substitutions applied
    const getCurrentText = () => {
      const baseText = textarea ? textarea.value : promptText;
      const values = getVariableValues(form, textPlaceholders, includeFlags, false);
      
      const substituted = substitutePlaceholders(baseText, values);
      return renderConditionalBlocks(substituted, values);
    };
    
    // Apply variables to textarea
    const handleApplyVariables = () => {
      if (!form || !textarea) return;
      
      const values = getVariableValues(form, textPlaceholders, includeFlags, true);
      const substitutedText = substitutePlaceholders(promptText, values);
      const renderedText = renderConditionalBlocks(substitutedText, values);
      textarea.value = renderedText;
      showToast('Variables applied to text', 'success');
    };
    
    if (applyBtn) {
      modal.addListener(applyBtn, 'click', handleApplyVariables);
    }
    
    // Initialize copen split button
    (async () => {
      try {
        const copenOptions = await getCopenOptions();
        activeCopenButton = initSplitButton({
          container: copenContainer,
          defaultLabel: COPEN_DEFAULT_LABEL,
          defaultIcon: COPEN_DEFAULT_ICON,
          options: copenOptions,
          onAction: async (target) => {
            const text = getCurrentText();
            await copyAndOpen(target, text);
          },
          storageKey: COPEN_STORAGE_KEY
        });
      } catch (error) {
        console.error('Failed to initialize copen button:', error);
      }
    })();

    const handleContinueAgent = async (e) => {
      if (e) e.preventDefault();
      
      const text = getCurrentText();
      
      // Close modal
      modal.destroy();
      
      const lastAgent = getLastAgent();
      if (lastAgent === 'jules') {
        try {
          const { handleTryInJules } = await import('./jules-api.js');
          await handleTryInJules(text);
        } catch (error) {
          console.error('Failed to send to Jules:', error);
          showToast('Failed to send to Jules', 'error');
        }
      } else if (lastAgent === 'openhands') {
        try {
          const { owner, repo } = getCurrentRepo();
          const branch = getCurrentBranch();
          const { showOpenHandsEnvModal } = await import('./openhands-modal.js');
          await showOpenHandsEnvModal(text, owner, repo, branch);
        } catch (error) {
          console.error('Failed to send to OpenHands:', error);
          showToast('Failed to send to OpenHands', 'error');
        }
      } else if (lastAgent === 'brace') {
        try {
          const { dispatchToAgent } = await import('./run-in-agent.js');
          await dispatchToAgent('brace', { promptText: text });
        } catch (error) {
          console.error('Failed to send to Brace:', error);
          showToast('Failed to send to Brace', 'error');
        }
      }
      
      resolve();
    };

    const handleCancel = () => {
      resolve();
      modal.destroy();
    };

    const handleCopy = async () => {
      const text = getCurrentText();
      const success = await copyText(text);
      if (success) {
        showToast('Copied to clipboard', 'success');
      } else {
        showToast('Clipboard blocked. Select and copy manually.', 'warn');
      }
    };
    
    const handleDownload = () => {
      const text = getCurrentText();
      downloadAsMarkdown(text, 'customized-prompt');
    };
    
    const handleSaveToGitHub = () => {
      const text = getCurrentText();
      saveToGitHub(text);
    };
    
    // Add tracked listeners
    if (form) {
      modal.addListener(form, 'submit', (e) => e.preventDefault());
    }
    modal.addListener(continueBtn, 'click', handleContinueAgent);
    modal.addListener(cancelBtn, 'click', handleCancel);
    modal.addListener(copyBtn, 'click', handleCopy);
    modal.addListener(downloadBtn, 'click', handleDownload);
    modal.addListener(saveBtn, 'click', handleSaveToGitHub);
    modal.addListener(closeBtn, 'click', handleCancel);

    // Close on background click
    modal.addListener(modalElement, 'click', (e) => {
      if (e.target === modalElement) {
        handleCancel();
      }
    });

    // Append to body and show
    document.body.appendChild(modalElement);
    modal.show();

    // Focus textarea after a short delay
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, TIMEOUTS.modalFocus);
  });
}
