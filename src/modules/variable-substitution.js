// ===== Prompt Variable Substitution Module =====
// Detects {PLACEHOLDER} variables in prompts and shows modal for user to fill values

import { PLACEHOLDER_REGEX, TIMEOUTS } from '../utils/constants.js';
import { createElement } from '../utils/dom-helpers.js';
import { createModal } from '../utils/modal-manager.js';

let activeVariableModal = null;

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
 * Builds the variable substitution modal DOM structure
 * @param {string[]} placeholders - Array of placeholder names
 * @returns {HTMLElement} The modal element
 */
function buildVariableModalDOM(placeholders) {
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
  const description = createElement('p', 'variable-modal__description', 
    'Fill in the values for the following variables (leave blank to use "N/A"):');
  modalBody.appendChild(description);

  const form = createElement('form', 'variable-modal__form');
  form.id = 'variableForm';

  // Create input field for each placeholder
  placeholders.forEach(placeholder => {
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

  modalBody.appendChild(form);

  const modalButtons = createElement('div', 'modal-buttons');
  const cancelBtn = createElement('button', 'btn', 'Cancel');
  cancelBtn.id = 'variableModalCancel';
  cancelBtn.type = 'button';

  const continueBtn = createElement('button', 'btn primary', 'Continue');
  continueBtn.id = 'variableModalContinue';
  continueBtn.type = 'submit';

  modalButtons.appendChild(cancelBtn);
  modalButtons.appendChild(continueBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalButtons);

  modal.appendChild(modalContent);
  
  return modal;
}

/**
 * Validates form (always returns true since fields are optional)
 * @param {HTMLFormElement} form - The form element
 * @returns {boolean} Always true
 */
function validateForm(form) {
  // All fields are optional, so validation always passes
  return true;
}

/**
 * Shows the variable substitution modal and collects user input
 * @param {string[]} placeholders - Array of placeholder names to fill
 * @param {string} promptText - The original prompt text
 * @returns {Promise<string|null>} Resolves to substituted text or null if cancelled
 */
export function showVariableModal(placeholders, promptText) {
  // Cleanup any existing modal first
  if (activeVariableModal) {
    activeVariableModal.destroy();
    activeVariableModal = null;
  }

  return new Promise((resolve) => {
    // Build new DOM element
    const modalElement = buildVariableModalDOM(placeholders);
    
    // Store active element for focus restoration
    const previouslyFocusedElement = document.activeElement;
    
    const form = modalElement.querySelector('#variableForm');
    const continueBtn = modalElement.querySelector('#variableModalContinue');
    const cancelBtn = modalElement.querySelector('#variableModalCancel');
    const closeBtn = modalElement.querySelector('#variableModalClose');

    // Create managed modal instance
    const modal = createModal({
      element: modalElement,
      onDestroy: () => {
        activeVariableModal = null;
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

    const handleSubmit = (e) => {
      e.preventDefault();
      
      // Collect values from form (use "N/A" for empty fields)
      const values = {};
      placeholders.forEach(placeholder => {
        const input = form.querySelector(`#var_${placeholder}`);
        if (input) {
          const value = input.value.trim();
          values[placeholder] = value || 'N/A';
        }
      });

      // Substitute placeholders in prompt text
      const substitutedText = substitutePlaceholders(promptText, values);

      resolve(substitutedText);
      modal.destroy();
    };

    const handleCancel = () => {
      resolve(null);
      modal.destroy();
    };
    
    // Add tracked listeners
    modal.addListener(form, 'submit', handleSubmit);
    modal.addListener(continueBtn, 'click', handleSubmit);
    modal.addListener(cancelBtn, 'click', handleCancel);
    modal.addListener(closeBtn, 'click', handleCancel);

    // Close on background click
    modal.addListener(modalElement, 'click', (e) => {
      if (e.target === modalElement) {
        handleCancel();
      }
    });

    // Focus management for inputs
    const inputs = form.querySelectorAll('.variable-modal__input');
    inputs.forEach(input => {
      modal.addListener(input, 'keydown', (e) => {
        // Submit on Enter key
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit(e);
        }
      });
    });

    // Append to body and show
    document.body.appendChild(modalElement);
    modal.show();

    // Focus first input after a short delay
    setTimeout(() => {
      const firstInput = form.querySelector('.variable-modal__input');
      if (firstInput) {
        firstInput.focus();
      }
    }, TIMEOUTS.modalFocus);
  });
}
