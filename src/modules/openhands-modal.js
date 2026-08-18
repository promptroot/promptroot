import { getAuth } from './firebase-service.js';
import { RepoSelector, BranchSelector } from './repo-branch-selector.js';
import { checkOpenHandsConfig } from './openhands-keys.js';
import { callRunOpenHandsFunction } from './openhands-api.js';
import { addToAgenticQueue } from './agentic-queue.js';
import { showToast } from './toast.js';

// ===== OpenHands Environment Selection Modal =====
// Allows selecting the repository and branch context before submitting a task.

let envModalCleanup = null;

export async function showOpenHandsEnvModal(promptText, owner = null, repo = null, branch = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    showToast('Please sign in to use OpenHands.', 'warn');
    return;
  }

  const hasConfig = await checkOpenHandsConfig(user.uid);
  if (!hasConfig) {
    showToast('OpenHands is not configured. Redirecting to Profile Settings...', 'warn');
    setTimeout(() => {
      window.location.href = '/pages/profile/profile.html';
    }, 2000);
    return;
  }

  // Pre-populate default repo and branch in selectors if provided
  const modal = document.getElementById('openhandsEnvModal');
  if (!modal) return;
  modal.classList.add('show');

  const submitBtn = document.getElementById('openhandsEnvSubmitBtn');
  const queueBtn = document.getElementById('openhandsEnvQueueBtn');
  const cancelBtn = document.getElementById('openhandsEnvCancelBtn');
  
  submitBtn.disabled = true;
  if (queueBtn) queueBtn.disabled = true;
  
  let selectedSourceId = null;
  let selectedBranch = null;

  if (owner && repo) {
    selectedSourceId = `sources/github/${owner}/${repo}`;
    selectedBranch = branch || 'main';
    
    // Pre-populate UI elements immediately
    const repoText = document.getElementById('openhandsRepoDropdownText');
    if (repoText) {
      repoText.textContent = `${owner}/${repo}`;
    }
    const branchText = document.getElementById('openhandsBranchDropdownText');
    if (branchText) {
      branchText.textContent = selectedBranch;
    }
    const branchBtn = document.getElementById('openhandsBranchDropdownBtn');
    if (branchBtn) {
      branchBtn.disabled = false;
      branchBtn.classList.remove('disabled');
    }
    submitBtn.disabled = false;
    if (queueBtn) queueBtn.disabled = false;
  }

  // Initialize BranchSelector first
  const branchSelector = new BranchSelector({
    dropdownBtn: document.getElementById('openhandsBranchDropdownBtn'),
    dropdownText: document.getElementById('openhandsBranchDropdownText'),
    dropdownMenu: document.getElementById('openhandsBranchDropdownMenu'),
    onSelect: (branch) => {
      selectedBranch = branch;
    }
  });

  // Initialize RepoSelector with branchSelector reference
  const repoSelector = new RepoSelector({
    dropdownBtn: document.getElementById('openhandsRepoDropdownBtn'),
    dropdownText: document.getElementById('openhandsRepoDropdownText'),
    dropdownMenu: document.getElementById('openhandsRepoDropdownMenu'),
    branchSelector: branchSelector,
    onSelect: (sourceId, branch, repoName) => {
      selectedSourceId = sourceId;
      selectedBranch = branch;
      submitBtn.disabled = false;
      if (queueBtn) queueBtn.disabled = false;
      branchSelector.initialize(sourceId, branch);
    }
  });

  try {
    await repoSelector.initialize();
    branchSelector.initialize(selectedSourceId, selectedBranch);
  } catch (err) {
    console.warn('Could not initialize repo/branch selectors (possibly due to missing Jules configuration):', err);
  }

  if (envModalCleanup) envModalCleanup();

  const handleSubmit = async () => {
    if (selectedSourceId) {
      const submitText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      const newWin = window.open('about:blank', '_blank');
      try {
        const sessionUrl = await callRunOpenHandsFunction(promptText, selectedSourceId, selectedBranch);
        if (sessionUrl) {
          if (newWin) {
            newWin.location.href = sessionUrl;
          } else {
            window.open(sessionUrl, '_blank', 'noopener,noreferrer');
          }
          showToast('OpenHands session started.', 'success', undefined, {
            link: { href: sessionUrl, label: 'Open Conversation' }
          });
          hideOpenHandsEnvModal();
        } else {
          if (newWin) newWin.close();
          submitBtn.disabled = false;
          submitBtn.textContent = submitText;
        }
      } catch (error) {
        if (newWin) newWin.close();
        showToast('Failed to start OpenHands session: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = submitText;
      }
    }
  };

  const handleQueue = async () => {
    if (!selectedSourceId || !selectedBranch) return;

    const user = getAuth()?.currentUser;
    if (!user) {
      showToast('Please sign in to use OpenHands.', 'warn');
      return;
    }

    try {
      await addToAgenticQueue(user.uid, {
        type: 'single',
        prompt: promptText,
        sourceId: selectedSourceId,
        branch: selectedBranch,
        destination: 'openhands',
        note: 'Queued for OpenHands'
      });
      showToast('Prompt queued for OpenHands!', 'success');
      hideOpenHandsEnvModal();
    } catch (err) {
      showToast('Failed to queue prompt: ' + err.message, 'error');
    }
  };

  const handleCancel = () => {
    hideOpenHandsEnvModal();
  };

  submitBtn.addEventListener('click', handleSubmit);
  if (queueBtn) queueBtn.addEventListener('click', handleQueue);
  cancelBtn.addEventListener('click', handleCancel);

  envModalCleanup = () => {
    submitBtn.removeEventListener('click', handleSubmit);
    if (queueBtn) queueBtn.removeEventListener('click', handleQueue);
    cancelBtn.removeEventListener('click', handleCancel);
    envModalCleanup = null;
  };
}

export function hideOpenHandsEnvModal() {
  const modal = document.getElementById('openhandsEnvModal');
  if (modal) {
    modal.classList.remove('show');
  }
  if (envModalCleanup) envModalCleanup();
}