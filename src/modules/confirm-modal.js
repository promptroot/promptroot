// ===== Confirmation Modal Module =====
// Provides styled confirmation dialogs to replace confirm() calls

import { TIMEOUTS } from '../utils/constants.js';
import { createElement } from '../utils/dom-helpers.js';
import { createModal } from '../utils/modal-manager.js';

let activeConfirmModal = null;

function buildConfirmModalDOM() {
  const modal = createElement('div', 'modal modal--confirm');
  modal.id = 'confirmModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'confirmModalTitle');

  const modalContent = createElement('div', 'modal-content');

  const modalHeader = createElement('div', 'modal-header');
  const title = createElement('h3', '', 'Confirm Action');
  title.id = 'confirmModalTitle';

  const closeBtn = createElement('button', 'btn-icon close-modal', '✕');
  closeBtn.id = 'confirmModalClose';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.title = 'Close';

  modalHeader.appendChild(title);
  modalHeader.appendChild(closeBtn);

  const modalBody = createElement('div', 'modal-body');
  const message = createElement('p');
  message.id = 'confirmModalMessage';

  modalBody.appendChild(message);

  const modalButtons = createElement('div', 'modal-buttons');
  const cancelBtn = createElement('button', 'btn', 'Cancel');
  cancelBtn.id = 'confirmModalCancel';

  const confirmBtn = createElement('button', 'btn danger', 'Confirm');
  confirmBtn.id = 'confirmModalConfirm';

  modalButtons.appendChild(cancelBtn);
  modalButtons.appendChild(confirmBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalButtons);

  modal.appendChild(modalContent);
  
  return modal;
}

/**
 * Show a styled confirmation dialog
 * @param {string} message - The confirmation message to display
 * @param {Object} options - Optional configuration
 * @param {string} options.title - Modal title (default: "Confirm Action")
 * @param {string} options.confirmText - Confirm button text (default: "Confirm")
 * @param {string} options.confirmStyle - Confirm button style: 'danger', 'warn', 'primary', 'success' (default: 'error')
 * @param {string} options.cancelText - Cancel button text (default: "Cancel")
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirm(message, options = {}) {
  // Cleanup any existing modal first
  if (activeConfirmModal) {
    activeConfirmModal.destroy();
    activeConfirmModal = null;
  }

  return new Promise((resolve) => {
    // Build new DOM element
    const modalElement = buildConfirmModalDOM();
    
    // Store active element for focus restoration
    const previouslyFocusedElement = document.activeElement;
    
    // Configure content
    const title = options.title || 'Confirm Action';
    const confirmText = options.confirmText || 'Confirm';
    const confirmStyle = options.confirmStyle || 'error';
    const cancelText = options.cancelText || 'Cancel';
    
    const titleEl = modalElement.querySelector('#confirmModalTitle');
    const messageEl = modalElement.querySelector('#confirmModalMessage');
    const confirmBtn = modalElement.querySelector('#confirmModalConfirm');
    const cancelBtn = modalElement.querySelector('#confirmModalCancel');
    const closeBtn = modalElement.querySelector('#confirmModalClose');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    
    // Set button style
    confirmBtn.className = 'btn';
    if (confirmStyle === 'error' || confirmStyle === 'danger') {
      confirmBtn.classList.add('danger');
    } else if (confirmStyle === 'warn') {
      confirmBtn.classList.add('warn');
    } else if (confirmStyle === 'primary') {
      confirmBtn.classList.add('primary');
    } else if (confirmStyle === 'success') {
      confirmBtn.classList.add('success');
    }

    // Create managed modal instance
    const modal = createModal({
      element: modalElement,
      onDestroy: () => {
        activeConfirmModal = null;
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

    activeConfirmModal = modal;

    const handleConfirm = () => {
      resolve(true);
      modal.destroy();
    };

    const handleCancel = () => {
      resolve(false);
      modal.destroy();
    };
    
    // Add tracked listeners
    modal.addListener(confirmBtn, 'click', handleConfirm);
    modal.addListener(cancelBtn, 'click', handleCancel);
    modal.addListener(closeBtn, 'click', handleCancel);

    // Close on background click
    modal.addListener(modalElement, 'click', (e) => {
      if (e.target === modalElement) {
        handleCancel();
      }
    });
    
    // Handle keyboard events (Escape and focus trap)
    modal.addListener(document, 'keydown', (e) => {
      // Safety check - only handle events if modal is visible
      if (!modalElement.classList.contains('show')) {
        return;
      }
      
      if (e.key === 'Escape') {
        handleCancel();
        return;
      }
      
      // Focus trap implementation
      if (e.key === 'Tab') {
        const focusableElements = modalElement.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        
        if (focusableElements.length === 0) return; // Safety check
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
          // Shift + Tab - move backward
          if (document.activeElement === firstElement || !modalElement.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab - move forward
          if (document.activeElement === lastElement || !modalElement.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });

    modal.show();
    
    // Focus the confirm button
    setTimeout(() => {
      if (confirmBtn) confirmBtn.focus();
    }, TIMEOUTS.modalFocus);
  });
}
