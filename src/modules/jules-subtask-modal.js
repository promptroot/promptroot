/**
 * jules-subtask-modal.js
 * Subtask split modal functionality for analyzing and splitting prompts into sequential subtasks
 */

import { getAuth } from './firebase-service.js';
import { analyzePromptStructure, buildSubtaskSequence, validateSubtasks } from './subtask-manager.js';
import { showSubtaskErrorModal, openUrlInBackground } from './jules-modal.js';
import { getLastSelectedSource } from './jules-free-input.js';
import { addToJulesQueue } from './jules-queue.js';
import { callRunJulesFunction } from './jules-api.js';
import { showToast } from './toast.js';
import { showConfirm } from './confirm-modal.js';
import { extractTitleFromPrompt } from '../utils/title.js';
import statusBar from './status-bar.js';
import { JULES_MESSAGES, TIMEOUTS, RETRY_CONFIG } from '../utils/constants.js';

// Module state
let currentFullPrompt = '';
let currentSubtasks = [];

/**
 * Show the subtask split modal for a given prompt
 * @param {string} promptText - The full prompt text to analyze and split
 */
export function showSubtaskSplitModal(promptText) {
  currentFullPrompt = promptText;
  
  const modal = document.getElementById('subtaskSplitModal');
  const confirmBtn = document.getElementById('splitConfirmBtn');
  const queueBtn = document.getElementById('splitQueueBtn');
  const cancelBtn = document.getElementById('splitCancelBtn');

  const analysis = analyzePromptStructure(promptText);
  currentSubtasks = analysis.subtasks;
  
  modal.classList.add('show');

  renderSplitEdit(currentSubtasks, promptText);

  confirmBtn.onclick = async () => {
    if (!currentSubtasks || currentSubtasks.length === 0) {
      hideSubtaskSplitModal();
      await submitSubtasks([]);
      return;
    }
    
    const validation = validateSubtasks(currentSubtasks);
    if (!validation.valid) {
      showToast('Error:\n' + validation.errors.join('\n'), 'error');
      return;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = await showConfirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nProceed anyway?', {
        title: 'Validation Warnings',
        confirmText: 'Proceed',
        confirmStyle: 'warn'
      });
      if (!proceed) return;
    }

    const subtasksToSubmit = [...currentSubtasks];
    hideSubtaskSplitModal();
    await submitSubtasks(subtasksToSubmit);
  };

  cancelBtn.onclick = () => {
    hideSubtaskSplitModal();
  };

  queueBtn.onclick = async () => {
    const user = getAuth()?.currentUser;
    if (!user) {
      showToast(JULES_MESSAGES.SIGN_IN_REQUIRED_SUBTASKS, 'warn');
      return;
    }

    const { sourceId, branch } = getLastSelectedSource();
    if (!sourceId) {
      showToast(JULES_MESSAGES.SELECT_REPO_FIRST, 'warn');
      return;
    }

    if (!branch) {
      showToast(JULES_MESSAGES.SELECT_BRANCH_FIRST, 'warn');
      return;
    }

    if (!currentSubtasks || currentSubtasks.length === 0) {
      try {
        await addToJulesQueue(user.uid, {
          type: 'single',
          prompt: currentFullPrompt,
          sourceId: sourceId,
          branch: branch,
          note: 'Queued from Split Dialog (no subtasks)'
        });
        showToast(JULES_MESSAGES.QUEUED, 'success');
        hideSubtaskSplitModal();
      } catch (err) {
        showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
      }
      return;
    }

    const validation = validateSubtasks(currentSubtasks);
    if (!validation.valid) {
      showToast('Error:\n' + validation.errors.join('\n'), 'error');
      return;
    }

    if (validation.warnings.length > 0) {
      const proceed = await showConfirm('Warnings:\n' + validation.warnings.join('\n') + '\n\nQueue anyway?', {
        title: 'Validation Warnings',
        confirmText: 'Queue',
        confirmStyle: 'warn'
      });
      if (!proceed) return;
    }

    try {
      const sequenced = buildSubtaskSequence(currentFullPrompt, currentSubtasks);
      const remaining = sequenced.map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));

      await addToJulesQueue(user.uid, {
        type: 'subtasks',
        prompt: currentFullPrompt,
        sourceId: sourceId,
        branch: branch,
        remaining,
        totalCount: remaining.length,
        note: 'Queued from Split Dialog'
      });

      hideSubtaskSplitModal();
      const { showFreeInputForm } = await import('./jules-free-input.js');
      showFreeInputForm();
      showToast(JULES_MESSAGES.subtasksQueued(remaining.length), 'success');
    } catch (err) {
      showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
    }
  };
}

/**
 * Hide the subtask split modal
 */
export function hideSubtaskSplitModal() {
  const modal = document.getElementById('subtaskSplitModal');
  modal.classList.remove('show');
  currentSubtasks = [];
}

/**
 * Render the subtask list in the split modal for editing
 * @param {Array} subtasks - Array of subtask objects
 * @param {string} promptText - The original prompt text
 */
function renderSplitEdit(subtasks, promptText) {
  const editList = document.getElementById('splitEditList');
  
  const promptPreview = promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText;
  
  // Create prompt display
  const promptDisplayDiv = document.createElement('div');
  promptDisplayDiv.className = 'subtask-modal__prompt-display';
  const promptContent = document.createElement('div');
  promptContent.className = 'subtask-modal__prompt-content';
  promptContent.textContent = promptPreview;
  promptDisplayDiv.appendChild(promptContent);
  
  editList.replaceChildren();
  editList.appendChild(promptDisplayDiv);
  
  if (!subtasks || subtasks.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'subtask-modal__empty-message';
    emptyMsg.textContent = 'No subtasks detected. This prompt will be sent as a single task.';
    editList.appendChild(emptyMsg);
    return;
  }
  
  subtasks.forEach((st, idx) => {
    const container = document.createElement('div');
    container.className = 'subtask-modal__item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `subtask-${idx}`;
    checkbox.checked = true;
    checkbox.className = 'subtask-modal__checkbox';
    
    const label = document.createElement('label');
    label.htmlFor = `subtask-${idx}`;
    label.className = 'subtask-modal__item-label';
    const strong = document.createElement('strong');
    strong.textContent = `Part ${idx + 1}:`;
    label.appendChild(strong);
    label.appendChild(document.createTextNode(` ${st.title || `Part ${idx + 1}`}`));
    
    const charCount = document.createElement('span');
    charCount.className = 'subtask-modal__char-count';
    charCount.textContent = `${st.content.length}c`;
    
    const previewBtn = document.createElement('button');
    previewBtn.className = 'subtask-preview-btn subtask-modal__preview-btn';
    previewBtn.dataset.idx = idx;
    previewBtn.title = 'Preview subtask';
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'visibility';
    previewBtn.appendChild(icon);
    
    container.append(checkbox, label, charCount, previewBtn);
    editList.appendChild(container);
  });

  subtasks.forEach((st, idx) => {
    const checkbox = document.getElementById(`subtask-${idx}`);
    checkbox.addEventListener('change', () => {
      currentSubtasks = subtasks.filter((_, i) => {
        return document.getElementById(`subtask-${i}`).checked;
      });
    });
  });
  
  document.querySelectorAll('.subtask-preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      showSubtaskPreview(subtasks[idx], idx + 1);
    });
  });
}

/**
 * Show preview modal for a specific subtask
 * @param {Object} subtask - The subtask to preview
 * @param {number} partNumber - The part number to display
 */
function showSubtaskPreview(subtask, partNumber) {
  const modal = document.getElementById('subtaskPreviewModal');
  const title = document.getElementById('subtaskPreviewTitle');
  const content = document.getElementById('subtaskPreviewContent');
  const closeBtn = document.getElementById('subtaskPreviewCloseBtn');
  
  title.textContent = `Part ${partNumber}: ${subtask.title || `Part ${partNumber}`}`;
  content.textContent = subtask.fullContent || subtask.content || '';
  
  modal.classList.add('show');
  
  closeBtn.onclick = () => {
    modal.classList.remove('show');
  };
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
}

/**
 * Submit subtasks to Jules, handling retries, pauses, and queueing
 * @param {Array} subtasks - Array of subtask objects to submit
 */
async function submitSubtasks(subtasks) {
  const suppressPopups = document.getElementById('splitSuppressPopupsCheckbox')?.checked || false;
  const openInBackground = document.getElementById('splitOpenInBackgroundCheckbox')?.checked || false;
  const { sourceId, branch } = getLastSelectedSource();
  
  if (!subtasks || subtasks.length === 0) {
    let retryCount = 0;
    let maxRetries = RETRY_CONFIG.maxRetries;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const title = extractTitleFromPrompt(currentFullPrompt);
        const sessionUrl = await callRunJulesFunction(currentFullPrompt, sourceId, branch, title);
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
        if (retryCount < maxRetries) {
          const result = await showSubtaskErrorModal(1, 1, error);
          if (result.action === 'cancel') {
            return;
          } else if (result.action === 'skip') {
            return;
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
            }
          }
        } else {
          const result = await showSubtaskErrorModal(1, 1, error);
          if (result.action === 'retry') {
            if (result.shouldDelay) {
              await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
            }
            try {
              const title = extractTitleFromPrompt(currentFullPrompt);
              const sessionUrl = await callRunJulesFunction(currentFullPrompt, sourceId, branch, title);
              if (sessionUrl) {
                if (openInBackground) {
                  openUrlInBackground(sessionUrl);
                } else {
                  window.open(sessionUrl, '_blank', 'noopener,noreferrer');
                }
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
    return;
  }
  
  const sequenced = buildSubtaskSequence(currentFullPrompt, subtasks);
  
  const totalCount = sequenced.length;
  const proceed = await showConfirm(
    `Ready to send ${totalCount} subtask${totalCount > 1 ? 's' : ''} to Jules.\n\n` +
    `Each subtask will be submitted sequentially. This may take a few minutes.\n\n` +
    `Proceed?`,
    {
      title: 'Submit Subtasks',
      confirmText: 'Submit',
      confirmStyle: 'primary'
    }
  );

  if (!proceed) {
    statusBar?.clear?.();
    return;
  }

  let skippedCount = 0;
  let successCount = 0;
  let paused = false;
  const user = getAuth()?.currentUser || null;

  statusBar?.showMessage?.(`Processing ${totalCount} subtasks...`, { timeout: 0 });
  statusBar?.setAction?.('Pause', () => {
    paused = true;
    statusBar?.showMessage?.('Pausing after current subtask...', { timeout: TIMEOUTS.statusBar });
    statusBar?.clearAction?.();
  });
  
  for (let i = 0; i < sequenced.length; i++) {
    const subtask = sequenced[i];
    
    let retryCount = 0;
    let maxRetries = RETRY_CONFIG.maxRetries;
    let submitted = false;

    while (retryCount < maxRetries && !submitted) {
      try {
        const title = extractTitleFromPrompt(subtask.fullContent) || subtask.title || '';
        const sessionUrl = await callRunJulesFunction(subtask.fullContent, sourceId, branch, title);
        if (sessionUrl && !suppressPopups) {
          if (openInBackground) {
            openUrlInBackground(sessionUrl);
          } else {
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          }
        }
        
        successCount++;
        submitted = true;

        // update status bar progress
        const percent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
        statusBar?.setProgress?.(`${successCount}/${totalCount}`, percent);
        statusBar?.showMessage?.(`Processing subtask ${successCount}/${totalCount}`, { timeout: 0 });

        // if user requested pause, queue remaining subtasks and stop
        if (paused) {
          const remaining = sequenced.slice(i + 1).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
          if (user && remaining.length > 0) {
            try {
              await addToJulesQueue(user.uid, {
                type: 'subtasks',
                prompt: currentFullPrompt,
                sourceId: sourceId,
                branch: branch,
                remaining,
                totalCount,
                note: 'Paused by user'
              });
              statusBar?.showMessage?.(`Paused and queued ${remaining.length} remaining subtasks`, { timeout: TIMEOUTS.longDelay });
            } catch (err) {
              console.warn('Failed to queue remaining subtasks on pause', err.message || err);
              statusBar?.showMessage?.('Paused but failed to save remaining subtasks', { timeout: TIMEOUTS.longDelay });
            }
          } else {
            statusBar?.showMessage?.('Paused', { timeout: TIMEOUTS.statusBar });
          }
          statusBar?.clear?.();
          // Only reload queue page if we're actually on that page
          const { loadQueuePage } = await import('../pages/queue-page.js');
          if (document.getElementById('allQueueList')) {
            await loadQueuePage();
          }
          return;
        }
      } catch (error) {
        retryCount++;

        if (retryCount < maxRetries) {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            statusBar?.clear?.();
            showToast(`Cancelled. Submitted ${successCount} of ${totalCount} ${successCount === 1 ? 'subtask' : 'subtasks'} before cancellation.`, 'warn');
            return;
          } else if (result.action === 'skip') {
            skippedCount++;
            submitted = true;
            statusBar?.showMessage?.(`Skipped subtask. Continuing with remaining...`, { timeout: TIMEOUTS.actionFeedback });
          } else if (result.action === 'queue') {
            const user = getAuth()?.currentUser;
            if (!user) {
              statusBar?.clear?.();
              showToast(JULES_MESSAGES.SIGN_IN_REQUIRED_SUBTASKS, 'warn');
              return;
            }
            const remaining = sequenced.slice(i).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
            try {
              await addToJulesQueue(user.uid, {
                type: 'subtasks',
                prompt: currentFullPrompt,
                sourceId: sourceId,
                branch: branch,
                remaining,
                totalCount,
                note: 'Queued remaining subtasks'
              });
              statusBar?.clear?.();
              showToast(JULES_MESSAGES.remainingQueued(remaining.length), 'success');
            } catch (err) {
              statusBar?.clear?.();
              showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
            }
            return;
          } else if (result.action === 'retry') {
            if (result.shouldDelay) {
              await new Promise(resolve => setTimeout(resolve, TIMEOUTS.longDelay));
            }
          }
        } else {
          const result = await showSubtaskErrorModal(
            subtask.sequenceInfo.current,
            subtask.sequenceInfo.total,
            error
          );

          if (result.action === 'cancel') {
            statusBar?.clear?.();
            showToast(JULES_MESSAGES.subtasksCancelled(successCount, totalCount), 'warn');
            return;
          } else {
            if (result.action === 'queue') {
              const user = getAuth()?.currentUser;
              if (!user) {
                statusBar?.clear?.();
                showToast(JULES_MESSAGES.SIGN_IN_REQUIRED_SUBTASKS, 'warn');
                return;
              }
              const remaining = sequenced.slice(i).map(s => ({ fullContent: s.fullContent, sequenceInfo: s.sequenceInfo }));
              try {
                await addToJulesQueue(user.uid, {
                  type: 'subtasks',
                  prompt: currentFullPrompt,
                  sourceId: sourceId,
                  branch: branch,
                  remaining,
                  totalCount,
                  note: 'Queued remaining subtasks (final failure)'
                });
                statusBar?.clear?.();
                showToast(JULES_MESSAGES.remainingQueued(remaining.length), 'success');
              } catch (err) {
                statusBar?.clear?.();
                showToast(JULES_MESSAGES.QUEUE_FAILED(err.message), 'error');
              }
              return;
            }
            skippedCount++;
            submitted = true;
            statusBar?.showMessage?.(`Skipped subtask. Continuing with remaining...`, { timeout: TIMEOUTS.actionFeedback });
          }
        }
      }

      if (!submitted && i < sequenced.length - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.baseDelay));
      }
    }
  }

  statusBar?.clear?.();
  
  const summary = `✓ Completed!\n\n` +
    `Successful: ${successCount}/${totalCount}\n` +
    `Skipped: ${skippedCount}/${totalCount}`;
  showToast(summary, 'success', 6000);
}
