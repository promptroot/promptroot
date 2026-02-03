// ===== Jules Modal Module =====
// Core modal UI functions (key modal, env modal, error modal)

import { getAuth } from './firebase-service.js';
import { encryptAndStoreKey } from './jules-keys.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { addToJulesQueue } from './jules-queue.js';
import { toggleVisibility } from '../utils/dom-helpers.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import { RETRY_CONFIG, TIMEOUTS, JULES_MESSAGES, JULES_MODAL_TEXT } from '../utils/constants.js';
import { showToast } from './toast.js';

let lastSelectedSourceId = 'sources/github/promptroot/promptroot';
let lastSelectedBranch = 'main';

export async function loadSubtaskErrorModal() {
  try {
    const response = await fetch('/partials/subtask-error-modal.html');
    if (response.ok) {
      const html = await response.text();
      document.body.insertAdjacentHTML('beforeend', html);
    }
  } catch (err) {
    console.error('Error loading subtask error modal:', err);
  }
}

export function openUrlInBackground(url) {
  // Open URL in background tab/window
  window.open(url, '_blank', 'noopener,noreferrer');
}

let keyModalCleanup = null;

export function showJulesKeyModal(onSave) {
  const modal = document.getElementById('julesKeyModal');
  const input = document.getElementById('julesKeyInput');
  
  modal.classList.add('show');
  input.value = '';
  input.focus();

  const saveBtn = document.getElementById('julesSaveBtn');
  const cancelBtn = document.getElementById('julesCancelBtn');

  // Initialize button text
  saveBtn.textContent = JULES_MODAL_TEXT.SAVE_BUTTON;
  cancelBtn.textContent = JULES_MODAL_TEXT.CANCEL_BUTTON;

  // Clean up any existing listeners
  if (keyModalCleanup) keyModalCleanup();

  const handleSave = async () => {
    const apiKey = input.value.trim();
    if (!apiKey) {
      showToast(JULES_MODAL_TEXT.ENTER_KEY_WARNING, 'warn');
      return;
    }

    try {
      saveBtn.textContent = JULES_MODAL_TEXT.SAVING;
      saveBtn.disabled = true;

      const user = getAuth()?.currentUser || null;
      if (!user) {
        showToast(JULES_MODAL_TEXT.NOT_LOGGED_IN, 'error');
        saveBtn.textContent = JULES_MODAL_TEXT.SAVE_BUTTON;
        saveBtn.disabled = false;
        return;
      }

      await encryptAndStoreKey(apiKey, user.uid);

      showToast(JULES_MODAL_TEXT.KEY_SAVED_SUCCESS, 'success');
      hideJulesKeyModal();
      saveBtn.textContent = JULES_MODAL_TEXT.SAVE_BUTTON;
      saveBtn.disabled = false;

      if (onSave) onSave();
    } catch (error) {
      showToast(JULES_MODAL_TEXT.KEY_SAVE_ERROR_PREFIX + error.message, 'error');
      saveBtn.textContent = JULES_MODAL_TEXT.SAVE_BUTTON;
      saveBtn.disabled = false;
    }
  };

  const handleCancel = () => {
    hideJulesKeyModal();
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);

  // Store cleanup function
  keyModalCleanup = () => {
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleCancel);
    keyModalCleanup = null;
  };
}

export function hideJulesKeyModal() {
  const modal = document.getElementById('julesKeyModal');
  modal.classList.remove('show');
  if (keyModalCleanup) keyModalCleanup();
}

let envModalCleanup = null;

export async function showJulesEnvModal(promptText) {
  const modal = document.getElementById('julesEnvModal');
  modal.classList.add('show');

  const submitBtn = document.getElementById('julesEnvSubmitBtn');
  const queueBtn = document.getElementById('julesEnvQueueBtn');
  const cancelBtn = document.getElementById('julesEnvCancelBtn');
  
  // Initialize button text
  submitBtn.textContent = JULES_MODAL_TEXT.SUBMIT_BUTTON;
  queueBtn.textContent = JULES_MODAL_TEXT.QUEUE_BUTTON;
  cancelBtn.textContent = JULES_MODAL_TEXT.CANCEL_BUTTON;

  // Initialize buttons
  submitBtn.disabled = true;
  queueBtn.disabled = true;
  
  let selectedSourceId = null;
  let selectedBranch = null;

  // Initialize BranchSelector first
  const branchSelector = new BranchSelector({
    dropdownBtn: document.getElementById('julesBranchDropdownBtn'),
    dropdownText: document.getElementById('julesBranchDropdownText'),
    dropdownMenu: document.getElementById('julesBranchDropdownMenu'),
    onSelect: (branch) => {
      selectedBranch = branch;
    }
  });

  // Initialize RepoSelector with branchSelector reference
  const repoSelector = new RepoSelector({
    dropdownBtn: document.getElementById('julesRepoDropdownBtn'),
    dropdownText: document.getElementById('julesRepoDropdownText'),
    dropdownMenu: document.getElementById('julesRepoDropdownMenu'),
    branchSelector: branchSelector,
    onSelect: (sourceId, branch, repoName) => {
      selectedSourceId = sourceId;
      selectedBranch = branch;
      submitBtn.disabled = false;
      queueBtn.disabled = false;
      branchSelector.initialize(sourceId, branch);
    }
  });

  // Load favorites and populate dropdown
  await repoSelector.initialize();
  branchSelector.initialize(null, null);

  // Clean up any existing listeners
  if (envModalCleanup) envModalCleanup();

  const handleSubmit = () => {
    if (selectedSourceId && selectedBranch) {
      const suppressPopups = document.getElementById('julesEnvSuppressPopupsCheckbox')?.checked || false;
      const openInBackground = document.getElementById('julesEnvOpenInBackgroundCheckbox')?.checked || false;
      handleRepoSelect(selectedSourceId, selectedBranch, promptText, suppressPopups, openInBackground);
    }
  };
  
  const handleQueue = async () => {
    if (!selectedSourceId || !selectedBranch) return;
    
    const user = getAuth()?.currentUser;
    if (!user) {
      showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
      return;
    }
    
    try {
      await addToJulesQueue(user.uid, {
        type: 'single',
        prompt: promptText,
        sourceId: selectedSourceId,
        branch: selectedBranch,
        note: JULES_MODAL_TEXT.NOTE_QUEUED_TRY
      });
      showToast(JULES_MESSAGES.QUEUED, 'success');
      hideJulesEnvModal();
    } catch (err) {
      showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
    }
  };
  
  const handleCancel = () => {
    hideJulesEnvModal();
  };

  submitBtn.addEventListener('click', handleSubmit);
  queueBtn.addEventListener('click', handleQueue);
  cancelBtn.addEventListener('click', handleCancel);

  // Store cleanup function
  envModalCleanup = () => {
    submitBtn.removeEventListener('click', handleSubmit);
    queueBtn.removeEventListener('click', handleQueue);
    cancelBtn.removeEventListener('click', handleCancel);
    envModalCleanup = null;
  };
}

async function handleRepoSelect(sourceId, branch, promptText, suppressPopups = false, openInBackground = false) {
  hideJulesEnvModal();
  
  lastSelectedSourceId = sourceId;
  lastSelectedBranch = branch || 'master';
  
  let retryCount = 0;
  let submitted = false;

  const { callRunJulesFunction } = await import('./jules-api.js');
  const title = extractTitleFromPrompt(promptText);
  
  while (retryCount < RETRY_CONFIG.maxRetries && !submitted) {
    try {
      const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch, title);
      if (sessionUrl && !suppressPopups) {
        if (openInBackground) {
          openUrlInBackground(sessionUrl);
        } else {
          window.open(sessionUrl, '_blank', 'noopener,noreferrer');
        }
      }
      submitted = true;
    } catch (error) {
      retryCount++;

      if (retryCount < RETRY_CONFIG.maxRetries) {
        const result = await showSubtaskErrorModal(1, 1, error);

        if (result.action === 'cancel') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'skip') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'queue') {
          const user = getAuth()?.currentUser;
          if (!user) {
            showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
            return;
          }
          try {
            await addToJulesQueue(user.uid, {
              type: 'single',
              prompt: promptText,
              sourceId: sourceId,
              branch: lastSelectedBranch,
              note: JULES_MODAL_TEXT.NOTE_QUEUED_PARTIAL_RETRY
            });
            showToast(JULES_MESSAGES.QUEUED, 'success');
          } catch (err) {
            showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
          }
          return;
        } else if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, TIMEOUTS.fetch));
          }
        }
      } else {
        const result = await showSubtaskErrorModal(1, 1, error);

        if (result.action === 'cancel') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'skip') {
          showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
          return;
        } else if (result.action === 'queue') {
          const user = getAuth()?.currentUser;
          if (!user) {
            showToast(JULES_MESSAGES.SIGN_IN_REQUIRED, 'warn');
            return;
          }
          try {
            await addToJulesQueue(user.uid, {
              type: 'single',
              prompt: promptText,
              sourceId: sourceId,
              branch: lastSelectedBranch,
              note: JULES_MODAL_TEXT.NOTE_QUEUED_FINAL_FAILURE
            });
            showToast(JULES_MESSAGES.QUEUED, 'success');
          } catch (err) {
            showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
          }
          return;
        }
        
        if (result.action === 'retry') {
          if (result.shouldDelay) {
            await new Promise(resolve => setTimeout(resolve, TIMEOUTS.fetch));
          }
          try {
            const sessionUrl = await callRunJulesFunction(promptText, sourceId, lastSelectedBranch, title);
            if (sessionUrl) {
              window.open(sessionUrl, '_blank', 'noopener,noreferrer');
            }
          } catch (finalError) {
            showToast(JULES_MESSAGES.FINAL_RETRY_FAILED, 'error');
          }
        }
        return;
      }
    }

    if (!submitted) {
      await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.baseDelay));
    }
  }
}

export function hideJulesEnvModal() {
  const modal = document.getElementById('julesEnvModal');
  modal.classList.remove('show');
  if (envModalCleanup) envModalCleanup();
}

export async function showSubtaskErrorModal(subtaskNumber, totalSubtasks, error, hideQueueButton = false) {
  let modal = document.getElementById('subtaskErrorModal');
  if (!modal) {
    await loadSubtaskErrorModal();
    modal = document.getElementById('subtaskErrorModal');
  }
  
  const subtaskNumDiv = document.getElementById('errorSubtaskNumber');
  const messageDiv = document.getElementById('errorMessage');
  const detailsDiv = document.getElementById('errorDetails');
  const retryBtn = document.getElementById('subtaskErrorRetryBtn');
  const skipBtn = document.getElementById('subtaskErrorSkipBtn');
  const queueBtn = document.getElementById('subtaskErrorQueueBtn');
  const cancelBtn = document.getElementById('subtaskErrorCancelBtn');
  const closeBtn = document.getElementById('errorModalClose');
  const retryDelayCheckbox = document.getElementById('errorRetryDelayCheckbox');

  if (!modal) {
    return { action: 'cancel', shouldDelay: false };
  }

  if (hideQueueButton && queueBtn) {
    toggleVisibility(queueBtn, false);
  } else if (queueBtn) {
    toggleVisibility(queueBtn, true);
  }

  return new Promise((resolve) => {
    subtaskNumDiv.textContent = JULES_MODAL_TEXT.SUBTASK_PROGRESS(subtaskNumber, totalSubtasks);
    messageDiv.textContent = error.message || String(error);
    detailsDiv.textContent = error.toString();

    modal.classList.add('show');

    // Define handlers for later cleanup
    let handleRetry, handleSkip, handleCancel, handleQueue, escapeHandler, backgroundClickHandler;

    const cleanup = () => {
      if (retryBtn) retryBtn.removeEventListener('click', handleRetry);
      if (skipBtn) skipBtn.removeEventListener('click', handleSkip);
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
      if (closeBtn) closeBtn.removeEventListener('click', handleCancel);
      if (queueBtn) queueBtn.removeEventListener('click', handleQueue);

      document.removeEventListener('keydown', escapeHandler);
      modal.removeEventListener('click', backgroundClickHandler);
    };

    const handleAction = (action) => {
      cleanup();
      hideSubtaskErrorModal();

      const shouldDelay = action === 'retry' ? retryDelayCheckbox.checked : false;
      resolve({ action, shouldDelay });
    };

    handleRetry = () => handleAction('retry');
    handleSkip = () => handleAction('skip');
    handleCancel = () => handleAction('cancel');
    handleQueue = () => handleAction('queue');

    if (retryBtn) retryBtn.addEventListener('click', handleRetry);
    if (skipBtn) skipBtn.addEventListener('click', handleSkip);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleCancel);
    if (queueBtn) queueBtn.addEventListener('click', handleQueue);
    
    // Handle Escape key
    escapeHandler = (e) => {
      if (e.key === 'Escape') {
        handleAction('cancel');
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Handle background click
    backgroundClickHandler = (e) => {
      if (e.target === modal) {
        handleAction('cancel');
      }
    };
    modal.addEventListener('click', backgroundClickHandler);
  });
}

export function hideSubtaskErrorModal() {
  const modal = document.getElementById('subtaskErrorModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

export function initJulesKeyModalListeners() {
  const keyModal = document.getElementById('julesKeyModal');
  const envModal = document.getElementById('julesEnvModal');
  const profileModal = document.getElementById('userProfileModal');
  const sessionsHistoryModal = document.getElementById('julesSessionsHistoryModal');
  const errorModal = document.getElementById('subtaskErrorModal');
  const keyInput = document.getElementById('julesKeyInput');

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      if (keyModal && keyModal.classList.contains('show')) {
        hideJulesKeyModal();
      }
      if (envModal && envModal.classList.contains('show')) {
        hideJulesEnvModal();
      }
      const freeInputSection = document.getElementById('freeInputSection');
      if (freeInputSection && !freeInputSection.classList.contains('hidden')) {
        const { hideFreeInputForm } = await import('./jules-free-input.js?v=' + Date.now());
        hideFreeInputForm();
      }
      if (profileModal && profileModal.classList.contains('show')) {
        const { hideUserProfileModal } = await import('./jules-account.js');
        hideUserProfileModal();
      }
      if (sessionsHistoryModal && sessionsHistoryModal.classList.contains('show')) {
        const { hideJulesSessionsHistoryModal } = await import('./jules-account.js');
        hideJulesSessionsHistoryModal();
      }
    }
  });

  if (keyModal) {
    keyModal.addEventListener('click', (e) => {
      if (e.target === keyModal) {
        hideJulesKeyModal();
      }
    });
  }

  if (envModal) {
    envModal.addEventListener('click', (e) => {
      if (e.target === envModal) {
        hideJulesEnvModal();
      }
    });
  }

  if (profileModal) {
    profileModal.addEventListener('click', async (e) => {
      if (e.target === profileModal) {
        const { hideUserProfileModal } = await import('./jules-account.js');
        hideUserProfileModal();
      }
    });
  }
  
  if (sessionsHistoryModal) {
    sessionsHistoryModal.addEventListener('click', async (e) => {
      if (e.target === sessionsHistoryModal) {
        const { hideJulesSessionsHistoryModal } = await import('./jules-account.js');
        hideJulesSessionsHistoryModal();
      }
    });
  }

  if (errorModal) {
    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) {
        e.preventDefault();
      }
    });
  }

  if (keyInput) {
    keyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('julesSaveBtn').click();
      }
    });
  }
}

export { lastSelectedSourceId, lastSelectedBranch };
