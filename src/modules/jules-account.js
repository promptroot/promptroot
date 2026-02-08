// ===== Jules Profile Modal Module =====
// Profile modal and sessions history functionality

import { getAuth } from './firebase-service.js';
import { checkJulesKey, deleteStoredJulesKey } from './jules-keys.js';
import { showJulesKeyModal } from './jules-modal.js';
import { showJulesQueueModal } from './jules-queue.js';
import { loadJulesProfileInfo, listJulesSessions, getDecryptedJulesKey } from './jules-api.js';
import { getCache, setCache, clearCache, CACHE_KEYS } from '../utils/session-cache.js';
import { showToast } from './toast.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';

// Error types for Jules account operations
const JulesAccountErrors = {
  KEY_CHECK_FAILED: 'KEY_CHECK_FAILED',
  PROFILE_LOAD_FAILED: 'PROFILE_LOAD_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR'
};
import { showConfirm } from './confirm-modal.js';
import { attachPromptViewerHandlers } from './prompt-viewer.js';
import { TIMEOUTS, JULES_UI_TEXT, CSS_CLASSES } from '../utils/constants.js';
import { renderStatus, STATUS_TYPES } from './status-renderer.js';
import { toggleVisibility } from '../utils/dom-helpers.js';
import { getHandler } from '../utils/handler-registry.js';

let allSessionsCache = [];
let sessionNextPageToken = null;

/**
 * Handles checking Jules key status and updating UI accordingly
 * @param {Object} user - User object with uid
 * @param {string} source - Source identifier for error tracking
 */
async function handleJulesKeyCheck(user, source) {
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  try {
    const hasKey = await checkJulesKey(user.uid);
    
    if (julesKeyStatus) {
      renderStatus(
        julesKeyStatus,
        hasKey ? STATUS_TYPES.SAVED : STATUS_TYPES.NOT_SAVED,
        hasKey ? 'Saved' : 'Not saved'
      );
    }

    if (hasKey) {
      if (addBtn) toggleVisibility(addBtn, false);
      if (dangerZoneSection) toggleVisibility(dangerZoneSection, true);
      if (julesProfileInfoSection) toggleVisibility(julesProfileInfoSection, true);

      await loadAndDisplayJulesProfile(user.uid);
    } else {
      if (addBtn) toggleVisibility(addBtn, true);
      if (dangerZoneSection) toggleVisibility(dangerZoneSection, false);
      if (julesProfileInfoSection) toggleVisibility(julesProfileInfoSection, false);
    }
  } catch (error) {
    // Determine specific error type
    let errorType = JulesAccountErrors.KEY_CHECK_FAILED;
    let errorCategory = ErrorCategory.NETWORK;
    
    if (error.message?.includes('auth') || error.code === 'permission-denied') {
      errorType = JulesAccountErrors.AUTH_ERROR;
      errorCategory = ErrorCategory.AUTH;
    } else if (error.message?.includes('network') || error.code === 'unavailable') {
      errorType = JulesAccountErrors.NETWORK_ERROR;
      errorCategory = ErrorCategory.NETWORK;
    }

    handleError(error, { source, errorType }, { category: errorCategory });
    
    if (julesKeyStatus) {
      renderStatus(julesKeyStatus, STATUS_TYPES.NOT_SAVED, 'Unable to check');
    }
    
    // Fallback to safe UI state
    if (addBtn) toggleVisibility(addBtn, true);
    if (dangerZoneSection) toggleVisibility(dangerZoneSection, false);
    if (julesProfileInfoSection) toggleVisibility(julesProfileInfoSection, false);
  }
}

export function showUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  const user = getAuth()?.currentUser;

  if (!user) {
    handleError('Not logged in.', { source: 'showUserProfileModal' }, { category: ErrorCategory.AUTH });
    return;
  }

  modal.classList.add('show');

  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const closeBtn = document.getElementById('closeProfileBtn');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'Unknown User';
  }

  // Check key status and update UI
  handleJulesKeyCheck(user, 'showUserProfileModal.checkKey');

  if (addBtn) {
    addBtn.onclick = () => {
      hideUserProfileModal();
      showJulesKeyModal(() => {
        setTimeout(() => showUserProfileModal(), TIMEOUTS.uiDelay);
      });
    };
  }

  if (resetBtn) {
    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        renderStatus(resetBtn, STATUS_TYPES.DELETING, 'Deleting...');
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            renderStatus(julesKeyStatus, STATUS_TYPES.NOT_SAVED, 'Not saved');
          }
          // Restore original button state
          resetBtn.replaceChildren();
          const icon = document.createElement('span');
          icon.className = 'icon icon-inline';
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = 'delete';
          resetBtn.appendChild(icon);
          resetBtn.appendChild(document.createTextNode(' Delete Jules API Key'));

          resetBtn.disabled = false;
          
          if (addBtn) toggleVisibility(addBtn, true);
          if (dangerZoneSection) toggleVisibility(dangerZoneSection, false);
          if (julesProfileInfoSection) toggleVisibility(julesProfileInfoSection, false);
          
          showToast('Jules API key has been deleted. You can enter a new one next time.', 'success');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        handleError(error, { source: 'resetJulesKeyBtn' }, { category: ErrorCategory.USER_ACTION });
        renderStatus(resetBtn, STATUS_TYPES.RESET, 'Reset Jules API Key');
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      hideUserProfileModal();
    };
  }
  
  attachViewAllSessionsHandler();
  attachViewQueueHandler();
  
  const closeSessionsHistoryBtn = document.getElementById('closeSessionsHistoryBtn');
  const loadMoreSessionsBtn = document.getElementById('loadMoreSessionsBtn');
  const sessionSearchInput = document.getElementById('sessionSearchInput');
  
  if (closeSessionsHistoryBtn) {
    closeSessionsHistoryBtn.onclick = () => {
      hideJulesSessionsHistoryModal();
    };
  }
  
  if (loadMoreSessionsBtn) {
    loadMoreSessionsBtn.onclick = () => {
      loadSessionsPage();
    };
  }
  
  if (sessionSearchInput) {
    sessionSearchInput.addEventListener('input', () => {
      const user = getAuth()?.currentUser;
      if (!user) return;
      renderAllSessions(allSessionsCache);
    });
  }
}

let profileHandlersAttached = false;

function attachViewAllSessionsHandler() {
  if (profileHandlersAttached) return;
  
  const viewAllSessionsLink = document.getElementById('viewAllSessionsLink');
  if (viewAllSessionsLink) {
    viewAllSessionsLink.onclick = (e) => {
      e.preventDefault();
      showJulesSessionsHistoryModal();
    };
  }
}

function attachViewQueueHandler() {
  const viewQueueLink = document.getElementById('viewQueueLink');
  if (viewQueueLink) {
    viewQueueLink.onclick = (e) => {
      e.preventDefault();
      showJulesQueueModal();
    };
  }
  
  profileHandlersAttached = true;
}

async function loadAndDisplayJulesProfile(uid) {
  const loadBtn = document.getElementById('loadJulesInfoBtn');
  const sourcesListDiv = document.getElementById('julesSourcesList');
  const sessionsListDiv = document.getElementById('julesSessionsList');

  try {
    loadBtn.disabled = true;
    
    // Check cache first
    let profileData = getCache(CACHE_KEYS.JULES_ACCOUNT, uid);
    
    if (!profileData) {
      const sourcesLoading = document.createElement('div');
      sourcesLoading.className = 'jules-loading-text';
      sourcesLoading.textContent = 'Loading sources...';
      sourcesListDiv.replaceChildren();
      sourcesListDiv.appendChild(sourcesLoading);
      
      const sessionsLoading = document.createElement('div');
      sessionsLoading.className = 'jules-loading-text';
      sessionsLoading.textContent = 'Loading sessions...';
      sessionsListDiv.replaceChildren();
      sessionsListDiv.appendChild(sessionsLoading);
      
      profileData = await loadJulesProfileInfo(uid);
      setCache(CACHE_KEYS.JULES_ACCOUNT, profileData, uid);
    }

    if (profileData.sources && profileData.sources.length > 0) {
      // Create source cards structure first
      const sourcesContainer = document.createElement('div');
      sourcesContainer.className = 'vlist';
      
      profileData.sources.forEach((source, index) => {
        const repoName = source.githubRepo?.name || source.name || source.id;
        const githubPath = repoName.includes('github/')
          ? repoName.split('github/')[1]
          : repoName.replace('sources/', '');
        const branches = source.githubRepo?.branches || [];
        const sourceId = `source-${index}`;

        const branchSummaryText = branches.length > 0
          ? JULES_UI_TEXT.BRANCH_COUNT(branches.length)
          : JULES_UI_TEXT.NO_BRANCHES_PARENS;

        // Create card container
        const card = document.createElement('div');
        card.className = 'queue-card';

        // Create row and content
        const row = document.createElement('div');
        row.className = 'queue-row';
        const content = document.createElement('div');
        content.className = 'queue-content';

        // Create header with expand/collapse
        const header = document.createElement('div');
        header.className = 'source-card__header queue-title';
        header.dataset.sourceId = sourceId;

        const arrow = document.createElement('span');
        arrow.id = `${sourceId}-arrow`;
        arrow.className = 'source-card__arrow';
        arrow.textContent = '▶';

        const folderIcon = document.createElement('span');
        folderIcon.className = 'icon icon-inline';
        folderIcon.setAttribute('aria-hidden', 'true');
        folderIcon.textContent = 'folder';

        const pathText = document.createTextNode(` ${githubPath} `);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'queue-status';
        statusSpan.textContent = branchSummaryText;

        header.append(arrow, folderIcon, pathText, statusSpan);

        // Create branches container
        const branchesContainer = document.createElement('div');
        branchesContainer.id = `${sourceId}-branches`;
        branchesContainer.className = `source-card__branches ${CSS_CLASSES.SOURCE_CARD_BRANCHES_HIDDEN}`;

        if (branches.length > 0) {
          const branchesHeader = document.createElement('div');
          branchesHeader.className = 'source-card__branches-header';
          const treeIcon = document.createElement('span');
          treeIcon.className = 'icon icon-inline';
          treeIcon.setAttribute('aria-hidden', 'true');
          treeIcon.textContent = 'account_tree';
          branchesHeader.appendChild(treeIcon);
          branchesHeader.appendChild(document.createTextNode(` ${JULES_UI_TEXT.BRANCHES_HEADER(branches.length)}`));
          branchesContainer.appendChild(branchesHeader);

          branches.forEach(b => {
            const branchItem = document.createElement('div');
            branchItem.className = 'source-card__branch-item';
            branchItem.dataset.githubPath = githubPath;
            branchItem.dataset.branchName = b.displayName || b.name;
            branchItem.textContent = b.displayName || b.name;
            branchesContainer.appendChild(branchItem);
          });
        } else {
          branchesContainer.className += ' source-card__empty';
          branchesContainer.textContent = JULES_UI_TEXT.NO_BRANCHES;
        }

        content.appendChild(header);
        row.appendChild(content);
        card.appendChild(row);
        card.appendChild(branchesContainer);
        sourcesContainer.appendChild(card);
      });

      // Clear and append
      sourcesListDiv.replaceChildren();
      sourcesListDiv.appendChild(sourcesContainer);

      // Attach event listeners for expand/collapse
      sourcesListDiv.querySelectorAll('.source-card__header').forEach(header => {
        header.addEventListener('click', () => {
          const sourceId = header.dataset.sourceId;
          const branchesContainer = document.getElementById(`${sourceId}-branches`);
          const arrow = document.getElementById(`${sourceId}-arrow`);
          
          if (branchesContainer.classList.contains(CSS_CLASSES.SOURCE_CARD_BRANCHES_HIDDEN)) {
            branchesContainer.classList.remove(CSS_CLASSES.SOURCE_CARD_BRANCHES_HIDDEN);
            arrow.classList.add(CSS_CLASSES.SOURCE_CARD_ARROW_EXPANDED);
            arrow.textContent = '▼';
          } else {
            branchesContainer.classList.add(CSS_CLASSES.SOURCE_CARD_BRANCHES_HIDDEN);
            arrow.classList.remove(CSS_CLASSES.SOURCE_CARD_ARROW_EXPANDED);
            arrow.textContent = '▶';
          }
        });
      });

      // Attach event listeners for branch links
      sourcesListDiv.querySelectorAll('.source-card__branch-item').forEach(item => {
        item.addEventListener('click', () => {
          const githubPath = item.dataset.githubPath;
          const branchName = item.dataset.branchName;
          window.open(`https://github.com/${githubPath}/tree/${encodeURIComponent(branchName)}`, '_blank');
        });
      });
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'jules-empty-state';
      emptyState.textContent = JULES_UI_TEXT.NO_SOURCES;
      const hint = document.createElement('small');
      hint.className = 'jules-empty-state__hint';
      hint.textContent = JULES_UI_TEXT.NO_SOURCES_HINT;
      emptyState.appendChild(document.createElement('br'));
      emptyState.appendChild(hint);
      sourcesListDiv.replaceChildren();
      sourcesListDiv.appendChild(emptyState);
    }

    if (profileData.sessions && profileData.sessions.length > 0) {
      // Create session cards using DOM APIs
      const sessionsContainer = document.createElement('div');
      sessionsContainer.className = 'vlist';
      
      profileData.sessions.forEach(session => {
        const state = session.state || 'UNKNOWN';
        const stateIcon = JULES_UI_TEXT.STATE_ICONS[state] || JULES_UI_TEXT.STATE_ICONS.UNKNOWN;
        const stateLabel = JULES_UI_TEXT.STATE_LABELS[state] || state.replace(/_/g, ' ');

        const promptPreview = (session.prompt || 'No prompt text').substring(0, 150);
        const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
        const createdAt = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
        const prUrl = session.outputs?.[0]?.pullRequest?.url;
        const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
        const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
        const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, '_');

        // Create card
        const card = document.createElement('div');
        card.className = CSS_CLASSES.SESSION_CARD;
        card.dataset.sessionUrl = sessionUrl;

        // Meta
        const meta = document.createElement('div');
        meta.className = 'session-meta';
        meta.textContent = createdAt;

        // Prompt
        const prompt = document.createElement('div');
        prompt.className = 'session-prompt';
        prompt.textContent = displayPrompt;

        // Row with pill, PR link, hint, view button
        const row = document.createElement('div');
        row.className = 'session-row';

        // State pill
        const pill = document.createElement('span');
        pill.className = 'session-pill';
        const pillIcon = document.createElement('span');
        pillIcon.className = 'icon icon-inline';
        pillIcon.setAttribute('aria-hidden', 'true');
        pillIcon.textContent = stateIcon;
        pill.appendChild(pillIcon);
        pill.appendChild(document.createTextNode(` ${stateLabel}`));
        row.appendChild(pill);

        // PR link if exists
        if (prUrl) {
          const prLink = document.createElement('a');
          prLink.href = prUrl;
          prLink.target = '_blank';
          prLink.rel = 'noopener';
          prLink.className = 'small-text';
          const prIcon = document.createElement('span');
          prIcon.className = 'icon icon-inline';
          prIcon.setAttribute('aria-hidden', 'true');
          prIcon.textContent = 'link';
          prLink.appendChild(prIcon);
          prLink.appendChild(document.createTextNode(' View PR'));
          row.appendChild(prLink);
        }

        // Hint
        const hint = document.createElement('span');
        hint.className = 'session-hint';
        const hintIcon = document.createElement('span');
        hintIcon.className = 'icon icon-inline';
        hintIcon.setAttribute('aria-hidden', 'true');
        hintIcon.textContent = 'info';
        hint.appendChild(hintIcon);
        hint.appendChild(document.createTextNode(` ${JULES_UI_TEXT.CLICK_VIEW_SESSION}`));
        row.appendChild(hint);

        // View button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-icon session-view-btn';
        viewBtn.title = JULES_UI_TEXT.VIEW_FULL_PROMPT;
        viewBtn.dataset.cleanId = cleanId;
        const viewIcon = document.createElement('span');
        viewIcon.className = 'icon';
        viewIcon.setAttribute('aria-hidden', 'true');
        viewIcon.textContent = 'visibility';
        viewBtn.appendChild(viewIcon);
        row.appendChild(viewBtn);

        card.append(meta, prompt, row);
        sessionsContainer.appendChild(card);
      });

      // Clear and append
      sessionsListDiv.replaceChildren();
      sessionsListDiv.appendChild(sessionsContainer);

      // Attach event listeners for session cards (main click)
      sessionsListDiv.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', () => {
          window.open(card.dataset.sessionUrl, '_blank', 'noopener');
        });
      });

      // Attach event listeners for view buttons
      sessionsListDiv.querySelectorAll('.session-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const cleanId = btn.dataset.cleanId;
          const handler = getHandler('promptViewer', cleanId);
          if (handler) {
            handler();
          }
        });
      });

      // Attach prompt viewer handlers using shared module
      attachPromptViewerHandlers(profileData.sessions);
    } else {
      const emptyState = document.createElement('div');
      emptyState.className = 'jules-empty-state';
      emptyState.textContent = JULES_UI_TEXT.NO_SESSIONS;
      sessionsListDiv.replaceChildren();
      sessionsListDiv.appendChild(emptyState);
    }

    loadBtn.disabled = false;
    loadBtn.replaceChildren();
    const syncIcon = document.createElement('span');
    syncIcon.className = 'icon';
    syncIcon.setAttribute('aria-hidden', 'true');
    syncIcon.textContent = 'sync';
    loadBtn.appendChild(syncIcon);


  } catch (error) {
    const errorInfo = handleError(error, { source: 'loadAndDisplayJulesProfile' }, { showDisplay: false });
    const errorMsg = errorInfo.suggestion
      ? `Failed: ${errorInfo.message}. ${errorInfo.suggestion}`
      : `Failed: ${errorInfo.message}`;

    const sourcesErr = document.createElement('div');
    sourcesErr.className = 'jules-error-state';
    sourcesErr.textContent = errorMsg;
    sourcesListDiv.replaceChildren();
    sourcesListDiv.appendChild(sourcesErr);
    
    const sessionsErr = document.createElement('div');
    sessionsErr.className = 'jules-error-state';
    sessionsErr.textContent = errorMsg;
    sessionsListDiv.replaceChildren();
    sessionsListDiv.appendChild(sessionsErr);

    loadBtn.disabled = false;
    loadBtn.replaceChildren();
    const errSyncIcon = document.createElement('span');
    errSyncIcon.className = 'icon';
    errSyncIcon.setAttribute('aria-hidden', 'true');
    errSyncIcon.textContent = 'sync';
    loadBtn.appendChild(errSyncIcon);
  }
}

export function hideUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  modal.classList.remove('show');
}

export function showJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  const searchInput = document.getElementById('sessionSearchInput');
  
  modal.classList.add('show');
  
  allSessionsCache = [];
  sessionNextPageToken = null;
  searchInput.value = '';
  
  loadSessionsPage();
}

export function hideJulesSessionsHistoryModal() {
  const modal = document.getElementById('julesSessionsHistoryModal');
  modal.classList.remove('show');
}

async function loadSessionsPage() {
  const user = getAuth()?.currentUser;
  if (!user) return;
  
  const allSessionsList = document.getElementById('allSessionsList');
  const loadMoreSection = document.getElementById('sessionsLoadMore');
  const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
  
  try {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';
    
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      throw new Error('Jules API key not found');
    }
    
    const result = await listJulesSessions(apiKey, 50, sessionNextPageToken);
    
    if (result.sessions && result.sessions.length > 0) {
      allSessionsCache = [...allSessionsCache, ...result.sessions];
      sessionNextPageToken = result.nextPageToken || null;
      
      renderAllSessions(allSessionsCache);
      
      if (sessionNextPageToken) {
        toggleVisibility(loadMoreSection, true);
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        toggleVisibility(loadMoreSection, false);
      }
    } else if (allSessionsCache.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'jules-empty-state jules-error-state--large';
      emptyMsg.textContent = 'No sessions found';
      allSessionsList.replaceChildren();
      allSessionsList.appendChild(emptyMsg);
    }
  } catch (error) {
    const errorInfo = handleError(error, { source: 'loadSessionsPage' }, { showDisplay: false });

    if (allSessionsCache.length === 0) {
      const errMsg = document.createElement('div');
      errMsg.className = 'jules-error-state jules-error-state--large';
      errMsg.textContent = `Failed to load sessions: ${errorInfo.message}`;
      allSessionsList.replaceChildren();
      allSessionsList.appendChild(errMsg);
    } else {
      handleError(error, { source: 'loadSessionsPage' }, { category: ErrorCategory.NETWORK });
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
  }
}

function renderAllSessions(sessions) {
  const allSessionsList = document.getElementById('allSessionsList');
  const searchInput = document.getElementById('sessionSearchInput');
  const searchTerm = searchInput.value.toLowerCase();
  
  const filteredSessions = searchTerm 
    ? sessions.filter(s => {
        const promptText = s.prompt || s.displayName || '';
        const sessionId = s.name?.split('/').pop() || '';
        return promptText.toLowerCase().includes(searchTerm) || sessionId.toLowerCase().includes(searchTerm);
      })
    : sessions;
  
  if (filteredSessions.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'jules-empty-state';
    emptyMsg.textContent = JULES_UI_TEXT.NO_SEARCH_RESULTS;
    allSessionsList.replaceChildren();
    allSessionsList.appendChild(emptyMsg);
    return;
  }
  
  // Clear list
  allSessionsList.replaceChildren();
  
  filteredSessions.forEach(session => {
    if (session.parentTask) {
      return;
    }
    
    const sessionId = session.name?.split('/').pop() || '';
    const state = session.state || 'UNKNOWN';
    const icon = JULES_UI_TEXT.STATE_ICONS[state] || JULES_UI_TEXT.STATE_ICONS.UNKNOWN;
    const label = JULES_UI_TEXT.STATE_LABELS[state] || state.replace(/_/g, ' ');
    
    const promptText = session.prompt || session.displayName || sessionId;
    const displayTitle = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
    
    const createTime = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const updateTime = session.updateTime ? new Date(session.updateTime).toLocaleString() : 'Unknown';
    
    const prUrl = session.githubPrUrl || null;
    const subtaskCount = session.childTasks?.length || 0;
    const sessionUrl = `https://jules.google.com/session/${sessionId}`;
    
    // Create card
    const card = document.createElement('div');
    card.className = 'session-card';
    card.dataset.sessionUrl = sessionUrl;
    
    // Top row with title and status
    const topRow = document.createElement('div');
    topRow.className = 'all-sessions__card-row';
    
    const title = document.createElement('div');
    title.className = 'all-sessions__title';
    title.textContent = displayTitle;
    
    const statusBadge = document.createElement('div');
    statusBadge.className = 'all-sessions__status-badge';
    const statusIcon = document.createElement('span');
    statusIcon.className = 'icon icon-inline';
    statusIcon.setAttribute('aria-hidden', 'true');
    statusIcon.textContent = icon;
    statusBadge.appendChild(statusIcon);
    statusBadge.appendChild(document.createTextNode(` ${label}`));
    
    topRow.append(title, statusBadge);
    card.appendChild(topRow);
    
    // Created time
    const createdDiv = document.createElement('div');
    createdDiv.className = 'all-sessions__meta';
    createdDiv.textContent = `Created: ${createTime}`;
    card.appendChild(createdDiv);
    
    // Updated time
    const updatedDiv = document.createElement('div');
    updatedDiv.className = 'all-sessions__meta all-sessions__meta--no-margin';
    updatedDiv.textContent = `Updated: ${updateTime}`;
    card.appendChild(updatedDiv);
    
    // Subtask info
    if (subtaskCount > 0) {
      const subtaskDiv = document.createElement('div');
      subtaskDiv.className = 'all-sessions__subtask-info';
      const subtaskIcon = document.createElement('span');
      subtaskIcon.className = 'icon icon-inline';
      subtaskIcon.setAttribute('aria-hidden', 'true');
      subtaskIcon.textContent = 'list_alt';
      subtaskDiv.appendChild(subtaskIcon);
      subtaskDiv.appendChild(document.createTextNode(` ${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}`));
      card.appendChild(subtaskDiv);
    }
    
    // PR link
    if (prUrl) {
      const prDiv = document.createElement('div');
      prDiv.className = 'all-sessions__pr-container';
      const prLink = document.createElement('a');
      prLink.href = prUrl;
      prLink.target = '_blank';
      prLink.className = 'all-sessions__pr-link';
      const prIcon = document.createElement('span');
      prIcon.className = 'icon icon-inline';
      prIcon.setAttribute('aria-hidden', 'true');
      prIcon.textContent = 'link';
      prLink.appendChild(prIcon);
      prLink.appendChild(document.createTextNode(' View PR'));
      prDiv.appendChild(prLink);
      card.appendChild(prDiv);
    }
    
    allSessionsList.appendChild(card);
  });
  
  // Attach event listeners to all session cards
  allSessionsList.querySelectorAll('.session-card').forEach(card => {
    card.addEventListener('click', () => {
      window.open(card.dataset.sessionUrl, '_blank');
    });
  });
}

export async function loadProfileDirectly(user) {
  const profileUserName = document.getElementById('profileUserName');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  const addBtn = document.getElementById('addJulesKeyBtn');
  const resetBtn = document.getElementById('resetJulesKeyBtn');
  const dangerZoneSection = document.getElementById('dangerZoneSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');

  if (profileUserName) {
    profileUserName.textContent = user.displayName || user.email || 'Unknown User';
  }

  // Check key status and update UI
  await handleJulesKeyCheck(user, 'loadProfileDirectly.checkKey');

  // Attach event handlers
  if (addBtn) {
    addBtn.onclick = () => {
      showJulesKeyModal(() => {
        setTimeout(() => loadProfileDirectly(user), TIMEOUTS.uiDelay);
      });
    };
  }

  if (resetBtn) {
    const originalResetLabel = resetBtn.textContent;
    resetBtn.onclick = async () => {
      const confirmed = await showConfirm(`This will delete your stored Jules API key. You'll need to enter a new one next time.`, {
        title: 'Delete API Key',
        confirmText: 'Delete',
        confirmStyle: 'error'
      });
      if (!confirmed) return;
      
      try {
        resetBtn.disabled = true;
        renderStatus(resetBtn, STATUS_TYPES.DELETING, 'Deleting...');
        const deleted = await deleteStoredJulesKey(user.uid);
        if (deleted) {
          if (julesKeyStatus) {
            renderStatus(julesKeyStatus, STATUS_TYPES.NOT_SAVED, 'Not saved');
          }
          resetBtn.textContent = originalResetLabel;
          resetBtn.disabled = false;
          
          if (addBtn) toggleVisibility(addBtn, true);
          if (dangerZoneSection) toggleVisibility(dangerZoneSection, false);
          if (julesProfileInfoSection) toggleVisibility(julesProfileInfoSection, false);
          
          showToast('Jules API key has been deleted. You can enter a new one next time.', 'success');
        } else {
          throw new Error('Failed to delete key');
        }
      } catch (error) {
        handleError(error, { source: 'loadProfileDirectly.resetBtn' }, { category: ErrorCategory.USER_ACTION });
        resetBtn.textContent = originalResetLabel;
        resetBtn.disabled = false;
      }
    };
  }

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      // Clear cache to force fresh data load
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
    };
  }
}

export async function loadJulesAccountInfo(user) {
  const julesProfileInfoSection = document.getElementById('julesProfileInfoSection');
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');

  // Check if user has Jules API key
  const hasKey = await checkJulesKey(user.uid);
  
  if (!hasKey) {
    if (julesProfileInfoSection) {
      toggleVisibility(julesProfileInfoSection, false);
    }
    return;
  }

  if (julesProfileInfoSection) {
    toggleVisibility(julesProfileInfoSection, true);
  }

  await loadAndDisplayJulesProfile(user.uid);

  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = async () => {
      // Clear cache to force fresh data load
      clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);
      
      await loadAndDisplayJulesProfile(user.uid);
    };
  }
}
