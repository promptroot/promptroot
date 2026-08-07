import { getCurrentUser } from './auth.js';
import { getAuth } from './firebase-service.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { showToast } from './toast.js';
import { copyAndOpen, clearCopenCache } from './copen.js';
import { toggleVisibility } from '../utils/dom-helpers.js';
import { JULES_MESSAGES, TIMEOUTS, RETRY_CONFIG } from '../utils/constants.js';
import { initSplitButton, updateSplitButtonOptions } from './split-button.js';
import { getCopenOptions, COPEN_STORAGE_KEY, COPEN_DEFAULT_LABEL, COPEN_DEFAULT_ICON } from '../utils/copen-config.js';
import { getLastAgent, saveLastAgent, getAgentOptions, dispatchToAgent } from './run-in-agent.js';
// Lazy loaded: jules-keys, jules-modal, jules-queue

let _lastSelectedSourceId = null;
let _lastSelectedBranch = null;
let _branchChangeListenerAdded = false;
let _freeInputCopenSplitBtn = null;
let _freeInputRunInAgentSplitBtn = null;
let _authListenerAdded = false;

async function refreshFreeInputCopenOptions() {
  const copenContainer = document.getElementById('freeInputCopenContainer');
  if (!copenContainer || !_freeInputCopenSplitBtn) return;
  
  try {
    const options = await getCopenOptions();
    updateSplitButtonOptions(copenContainer, options);
  } catch (error) {
    console.error('Error refreshing free input copen options:', error);
  }
}

export function getLastSelectedSource() {
  return { sourceId: _lastSelectedSourceId, branch: _lastSelectedBranch };
}

export function showFreeInputModal() {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    (async () => {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => showFreeInputModal(), TIMEOUTS.uiDelay);
      } catch (error) {
        showToast('Login required to use Jules.', 'warn');
      }
    })();
    return;
  }

  handleFreeInputAfterAuth();
}

export async function handleFreeInputAfterAuth() {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    showToast('Not logged in.', 'error');
    return;
  }

  try {
    const { checkJulesKey } = await import('./jules-keys.js');
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      const { showJulesKeyModal } = await import('./jules-modal.js');
      showJulesKeyModal(() => {
        showFreeInputForm();
      });
    } else {
      showFreeInputForm();
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
}

export async function showFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const actions = document.getElementById('actions');
  const content = document.getElementById('content');
  
  // Gracefully handle missing Free Input elements in non-UI contexts (e.g., tests)
  if (!freeInputSection) {
    console.warn('Free Input section not found; skipping UI rendering');
    return;
  }
  
  empty.classList.add('hidden');
  if (title) title.classList.add('hidden');
  if (meta) meta.classList.add('hidden');
  if (actions) actions.classList.add('hidden');
  if (content) {
    toggleVisibility(content, false);
  }
  
  toggleVisibility(freeInputSection, true);
  
  const textarea = document.getElementById('freeInputTextarea');
  const runInAgentContainer = document.getElementById('freeInputRunInAgentContainer');
  const queueBtn = document.getElementById('freeInputQueueBtn');
  const splitBtn = document.getElementById('freeInputSplitBtn');
  const saveBtn = document.getElementById('freeInputSaveBtn');
  const cancelBtn = document.getElementById('freeInputCancelBtn');
  const copenContainer = document.getElementById('freeInputCopenContainer');
  
  if (!textarea || !runInAgentContainer || !queueBtn || !splitBtn || !saveBtn || !cancelBtn || !copenContainer) {
    console.warn('Free Input controls not found; skipping UI rendering');
    return;
  }

  textarea.value = '';
  
  populateFreeInputRepoSelection();
  
  if (!_branchChangeListenerAdded) {
    window.addEventListener('branchChanged', (event) => {
      if (event.detail && event.detail.branch) {
        _lastSelectedBranch = event.detail.branch;
      }
    });
    _branchChangeListenerAdded = true;
  }
  
  textarea.focus();

  const validatePromptText = (customMessage = 'Please enter a prompt.') => {
    const promptText = textarea.value.trim();
    if (!promptText) {
      showToast(customMessage, 'warn');
      return null;
    }
    return promptText;
  };

  if (!_freeInputCopenSplitBtn && copenContainer) {
    const options = await getCopenOptions();
    _freeInputCopenSplitBtn = initSplitButton({
      container: copenContainer,
      defaultLabel: COPEN_DEFAULT_LABEL,
      defaultIcon: COPEN_DEFAULT_ICON,
      options: options,
      onAction: async (target) => {
        const promptText = validatePromptText();
        if (!promptText) return;
        await copyAndOpen(target, promptText);
      },
      storageKey: COPEN_STORAGE_KEY
    });
  }
  
  // Always refresh copen options when form is shown (in case user logged in or copens changed)
  if (_freeInputCopenSplitBtn && copenContainer) {
    const options = await getCopenOptions();
    updateSplitButtonOptions(copenContainer, options);
  }
  
  // Also refresh when user logs in (for hard refresh case)
  if (!_authListenerAdded) {
    const auth = getAuth();
    if (auth) {
      auth.onAuthStateChanged(async (user) => {
        if (user && _freeInputCopenSplitBtn && copenContainer) {
          const options = await getCopenOptions();
          updateSplitButtonOptions(copenContainer, options);
        }
      });
    }
    _authListenerAdded = true;
  }

  const updateButtonStates = () => {
    const hasText = textarea.value.trim().length > 0;
    
    queueBtn.disabled = !hasText;
    splitBtn.disabled = !hasText;
    saveBtn.disabled = !hasText;
    cancelBtn.disabled = !hasText;
    
    const copenActionBtn = copenContainer.querySelector('.split-btn__action');
    const copenToggleBtn = copenContainer.querySelector('.split-btn__toggle');
    if (copenActionBtn) {
      copenActionBtn.disabled = !hasText;
    }
    if (copenToggleBtn) {
      copenToggleBtn.disabled = !hasText;
    }

    const agentActionBtn = runInAgentContainer.querySelector('.split-btn__action');
    const agentToggleBtn = runInAgentContainer.querySelector('.split-btn__toggle');
    if (agentActionBtn) {
      agentActionBtn.disabled = !hasText;
    }
    if (agentToggleBtn) {
      agentToggleBtn.disabled = !hasText;
    }
  };

  updateButtonStates();

  textarea.addEventListener('input', updateButtonStates);

  const handleSubmit = async () => {
    const promptText = validatePromptText();
    if (!promptText) return;

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }
    
    const suppressPopups = document.getElementById('freeInputSuppressPopupsCheckbox')?.checked || false;
    const openInBackground = document.getElementById('freeInputOpenInBackgroundCheckbox')?.checked || false;

    let title = '';
    const lines = promptText.split(/\r?\n/);
    if (lines.length > 0 && /^#\s+/.test(lines[0])) {
      title = lines[0].replace(/^#\s+/, '').trim();
    } else if (lines.length > 0) {
      title = lines[0].substring(0, 50).trim();
    }

    textarea.value = '';
    updateButtonStates();
    textarea.focus();

    const { callRunJulesFunction } = await import('./jules-api.js');
    const { openUrlInBackground } = await import('./jules-modal.js');

    try {
      let retryCount = 0;
      let maxRetries = RETRY_CONFIG.maxRetries;
      let submitted = false;

      while (retryCount < maxRetries && !submitted) {
        try {
          const sessionUrl = await callRunJulesFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
          if (sessionUrl && !suppressPopups) {
            if (openInBackground) {
              openUrlInBackground(sessionUrl);
            } else {
              window.open(sessionUrl, '_blank', 'noopener,noreferrer');
            }
          }
          showToast('Prompt sent to Jules successfully!', 'success');
          submitted = true;
        } catch (error) {
          retryCount++;

          if (retryCount < maxRetries) {
            const { showSubtaskErrorModal } = await import('./jules-modal.js');
            const result = await showSubtaskErrorModal(1, 1, error);

            if (result.action === 'cancel') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'skip') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'queue') {
              const { handleQueueAction } = await import('./jules-queue.js');
              await handleQueueAction({
                type: 'single',
                prompt: promptText,
                sourceId: _lastSelectedSourceId,
                branch: _lastSelectedBranch,
                note: 'Queued from Free Input flow'
              });
              showFreeInputForm();
              return;
            } else if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
              }
            }
          } else {
            const { showSubtaskErrorModal } = await import('./jules-modal.js');
            const result = await showSubtaskErrorModal(1, 1, error);

            if (result.action === 'cancel') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'skip') {
              showToast(JULES_MESSAGES.cancelled(0, 1), 'warn');
              return;
            } else if (result.action === 'queue') {
              const { handleQueueAction } = await import('./jules-queue.js');
              await handleQueueAction({
                type: 'single',
                prompt: promptText,
                sourceId: _lastSelectedSourceId,
                branch: _lastSelectedBranch,
                note: 'Queued from Free Input flow (final failure)'
              });
              showFreeInputForm();
              return;
            }

            if (result.action === 'retry') {
              if (result.shouldDelay) {
                await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
              }
              try {
                const sessionUrl = await callRunJulesFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
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
    } catch (error) {
      showToast('Failed to submit prompt: ' + error.message, 'error');
    }
  };

  const handleSplit = async () => {
    const promptText = validatePromptText();
    if (!promptText) return;

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }
    
    try {
      const { showSubtaskSplitModal } = await import('./jules-subtask-modal.js');
      showSubtaskSplitModal(promptText);
    } catch (error) {
      console.error('Error showing modal:', error);
      showToast('Failed to process prompt: ' + error.message, 'error');
    }
  };

  const handleCancel = () => {
    textarea.value = '';
    updateButtonStates();
    textarea.focus();
  };

  const handleSave = async () => {
    const promptText = validatePromptText('Please enter content to save.');
    if (!promptText) return;

    let sourceId = _lastSelectedSourceId;
    if (!sourceId) {
      try {
        const { getCurrentRepo } = await import('./branch-selector.js');
        const currentRepoContext = getCurrentRepo();
        if (currentRepoContext.owner && currentRepoContext.repo) {
          sourceId = `sources/github/${currentRepoContext.owner}/${currentRepoContext.repo}`;
        }
      } catch (error) {
        console.warn('Could not get current repo context:', error);
      }
      if (!sourceId) {
        sourceId = 'sources/github/promptroot/promptroot';
      }
    }
    
    let branch = null;
    try {
      const { getCurrentBranch } = await import('./branch-selector.js');
      branch = getCurrentBranch();
    } catch (error) {
      console.warn('Could not get current branch from header selector:', error);
    }
    
    if (!branch) {
      branch = _lastSelectedBranch || 'main';
    }
    
    const parts = sourceId.split('/');
    const owner = parts[parts.length - 2];
    const repo = parts[parts.length - 1];
    
    const encoded = encodeURIComponent(promptText);
    const now = new Date();
    const timestamp = `${now.getFullYear().toString().slice(-2)}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
    const newFilePath = `prompts/prompt-${timestamp}.md`;
    const ghUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(newFilePath)}&value=${encoded}&ref=${encodeURIComponent(branch)}`;
    
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
    showToast('Opening GitHub to save your prompt...', 'success');
  };

  const handleQueue = async () => {
    const promptText = validatePromptText();
    if (!promptText) return;

    if (!_lastSelectedSourceId) {
      showToast('Please select a repository.', 'warn');
      return;
    }

    if (!_lastSelectedBranch) {
      showToast('Please select a branch.', 'warn');
      return;
    }

    const user = getAuth()?.currentUser;
    if (!user) {
      showToast('Please sign in to queue prompts.', 'warn');
      return;
    }

    try {
      const { addToAgenticQueue } = await import('./agentic-queue.js');
      // Use the split button's current in-session selection rather than getLastAgent()
      // (which reads localStorage and may be stale if the user changed the dropdown
      // this session without submitting).
      const selectedAgent = _freeInputRunInAgentSplitBtn?.getSelection() || 'jules';
      await addToAgenticQueue(user.uid, {
        type: 'single',
        prompt: promptText,
        sourceId: _lastSelectedSourceId,
        branch: _lastSelectedBranch,
        destination: selectedAgent,
        note: 'Queued from Free Input'
      });
      showToast(`Prompt queued for ${selectedAgent === 'brace' ? 'Brace' : 'Jules'}!`, 'success');
      showFreeInputForm();
    } catch (err) {
      showToast('Failed to queue prompt: ' + err.message, 'error');
    }
  };

  // Initialize split button for copen if not already initialized
  if (!_freeInputCopenSplitBtn && copenContainer) {
    _freeInputCopenSplitBtn = initSplitButton({
      container: copenContainer,
      defaultLabel: COPEN_DEFAULT_LABEL,
      defaultIcon: COPEN_DEFAULT_ICON,
      options: [],
      onAction: async (target) => {
        const promptText = validatePromptText();
        if (!promptText) return;
        await copyAndOpen(target, promptText);
      },
      storageKey: COPEN_STORAGE_KEY
    });
    
    // Load user's copen options
    refreshFreeInputCopenOptions();
    
    // Listen for auth changes
    const auth = getAuth();
    if (auth) {
      auth.onAuthStateChanged(() => {
        clearCopenCache();
        refreshFreeInputCopenOptions();
      });
    }
    
    // Listen for copen changes
    window.addEventListener('copensChanged', () => {
      clearCopenCache();
      refreshFreeInputCopenOptions();
    });
  }

  // Initialize run-in-agent split button if not already initialized
  if (!_freeInputRunInAgentSplitBtn && runInAgentContainer) {
    const lastAgent = getLastAgent();

    _freeInputRunInAgentSplitBtn = initSplitButton({
      container: runInAgentContainer,
      defaultLabel: 'Run in Agent',
      defaultIcon: 'send',
      options: getAgentOptions(),
      executeOnSelect: false,
      onAction: async (selectedAgent) => {
        console.log('[FreeInput] Run in Agent action triggered:', selectedAgent);
        saveLastAgent(selectedAgent);
        if (selectedAgent === 'jules') {
          console.log('[FreeInput] Running Jules flow');
          // Jules uses handleSubmit() which manages its own modal/retry/key-check flow.
          // We don't route through dispatchToAgent here because that would call
          // callRunJulesFunction directly, bypassing the callback machinery in handleSubmit.
          await handleSubmit();
        } else if (selectedAgent === 'openhands') {
          console.log('[FreeInput] Running OpenHands flow');
          const promptText = validatePromptText();
          console.log('[FreeInput] Prompt text validated:', promptText ? 'length ' + promptText.length : 'empty');
          if (!promptText) return;

          console.log('[FreeInput] Selected repo context:', _lastSelectedSourceId, 'branch:', _lastSelectedBranch);
          if (!_lastSelectedSourceId) {
            showToast('Please select a repository.', 'warn');
            return;
          }
          if (!_lastSelectedBranch) {
            showToast('Please select a branch.', 'warn');
            return;
          }

          try {
            const { getAuth } = await import('./firebase-service.js');
            const user = getAuth()?.currentUser;
            console.log('[FreeInput] Auth user:', user ? user.uid : 'none');
            if (!user) {
              showToast('Please sign in to use OpenHands.', 'warn');
              return;
            }

            const { checkOpenHandsConfig } = await import('./openhands-keys.js');
            const hasConfig = await checkOpenHandsConfig(user.uid);
            console.log('[FreeInput] Has OpenHands config:', hasConfig);
            if (!hasConfig) {
              showToast('OpenHands is not configured. Redirecting to Profile Settings...', 'warn');
              setTimeout(() => {
                window.location.href = '/pages/profile/profile.html';
              }, 2000);
              return;
            }

            const { callRunOpenHandsFunction } = await import('./openhands-api.js');

            const submitBtn = runInAgentContainer.querySelector('.split-btn__action');
            const submitHtml = submitBtn ? submitBtn.innerHTML : 'OpenHands';
            console.log('[FreeInput] Action button element:', submitBtn);
            if (submitBtn) {
              submitBtn.disabled = true;
              submitBtn.innerHTML = 'Submitting...';
            }

            let title = '';
            const lines = promptText.split(/\r?\n/);
            if (lines.length > 0 && /^#\s+/.test(lines[0])) {
              title = lines[0].replace(/^#\s+/, '').trim();
            } else if (lines.length > 0) {
              title = lines[0].substring(0, 50).trim();
            }

            const newWin = window.open('about:blank', '_blank');
            try {
              console.log('[FreeInput] Calling callRunOpenHandsFunction...');
              const sessionUrl = await callRunOpenHandsFunction(promptText, _lastSelectedSourceId, _lastSelectedBranch, title);
              console.log('[FreeInput] callRunOpenHandsFunction returned sessionUrl:', sessionUrl);
              if (sessionUrl) {
                if (newWin) {
                  newWin.location.href = sessionUrl;
                } else {
                  window.open(sessionUrl, '_blank', 'noopener,noreferrer');
                }
                showToast('OpenHands session started successfully. <a href="' + sessionUrl + '" target="_blank" style="text-decoration: underline; color: #5cb85c; font-weight: bold;">Open Workspace</a>', 'success');
                textarea.value = '';
                updateButtonStates();
              } else if (newWin) {
                newWin.close();
              }
            } catch (err) {
              if (newWin) newWin.close();
              console.error('[FreeInput] OpenHands flow inner error:', err);
              showToast('Failed to start OpenHands session: ' + err.message, 'error');
            } finally {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitHtml;
              }
            }
          } catch (error) {
            console.error('[FreeInput] Failed to load OpenHands flow dependencies:', error);
            showToast('Failed to start OpenHands flow', 'error');
          }
        } else if (selectedAgent === 'brace') {
          console.log('[FreeInput] Running Brace flow');
          const promptText = validatePromptText();
          if (!promptText) return;
          dispatchToAgent('brace', { promptText });
        }
      }
    });

    // Set initial selection to last used agent
    if (_freeInputRunInAgentSplitBtn && lastAgent !== 'jules') {
      _freeInputRunInAgentSplitBtn.setSelection(lastAgent);
    }
  }

  queueBtn.onclick = handleQueue;
  splitBtn.onclick = handleSplit;
  saveBtn.onclick = handleSave;
  cancelBtn.onclick = handleCancel;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  });
}

export function destroyFreeInputRunInAgent() {
  if (_freeInputRunInAgentSplitBtn) {
    _freeInputRunInAgentSplitBtn.destroy();
    _freeInputRunInAgentSplitBtn = null;
  }
}

export function hideFreeInputForm() {
  const freeInputSection = document.getElementById('freeInputSection');
  const empty = document.getElementById('empty');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const actions = document.getElementById('actions');
  const content = document.getElementById('content');
  
  toggleVisibility(freeInputSection, false);
  
  // Restore the main content area elements
  toggleVisibility(empty, true);
  if (title) toggleVisibility(title, true);
  if (meta) toggleVisibility(meta, true);
  if (actions) toggleVisibility(actions, true);
  if (content) toggleVisibility(content, true);
}

async function populateFreeInputRepoSelection() {
  _lastSelectedSourceId = null;
  _lastSelectedBranch = null;
  
  const repoDropdownText = document.getElementById('freeInputRepoDropdownText');
  const repoDropdownBtn = document.getElementById('freeInputRepoDropdownBtn');
  const repoDropdownMenu = document.getElementById('freeInputRepoDropdownMenu');
  const branchDropdownBtn = document.getElementById('freeInputBranchDropdownBtn');
  const branchDropdownText = document.getElementById('freeInputBranchDropdownText');
  const branchDropdownMenu = document.getElementById('freeInputBranchDropdownMenu');

  if (!repoDropdownText || !repoDropdownBtn || !repoDropdownMenu ||
      !branchDropdownBtn || !branchDropdownText || !branchDropdownMenu) {
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    repoDropdownText.textContent = 'Please sign in first';
    repoDropdownBtn.disabled = true;
    return;
  }

  const branchSelector = new BranchSelector({
    dropdownBtn: branchDropdownBtn,
    dropdownText: branchDropdownText,
    dropdownMenu: branchDropdownMenu,
    onSelect: (branch) => {
      _lastSelectedBranch = branch;
    }
  });

  const repoSelector = new RepoSelector({
    favoriteContainer: null,
    dropdownBtn: repoDropdownBtn,
    dropdownText: repoDropdownText,
    dropdownMenu: repoDropdownMenu,
    branchSelector: branchSelector,
    onSelect: (sourceId, branch, repoName) => {
      _lastSelectedSourceId = sourceId;
      _lastSelectedBranch = branch;
      branchSelector.initialize(sourceId, branch);
    }
  });

  await repoSelector.initialize();
  branchSelector.initialize(null, null);
}

window.populateFreeInputRepoSelection = populateFreeInputRepoSelection;
