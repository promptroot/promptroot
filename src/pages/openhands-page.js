/**
 * OpenHands Page Initialization
 * Handles OpenHands workspace functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { checkOpenHandsConfig, getDecryptedOpenHandsConfig } from '../modules/openhands-keys.js';
import { loadOpenHandsProfileInfo, pauseSandbox, resumeSandbox } from '../modules/openhands-api.js';
import { showToast } from '../modules/toast.js';
import { TIMEOUTS } from '../utils/constants.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadOpenHandsInfo() {
  const auth = getAuth();
  const user = auth?.currentUser;
  
  const loadingDiv = document.getElementById('openhandsLoading');
  const notSignedInDiv = document.getElementById('openhandsNotSignedIn');
  const noConfigSection = document.getElementById('noOpenhandsConfigSection');
  const openhandsContentSection = document.getElementById('openhandsContentSection');
  const loadBtn = document.getElementById('loadOpenhandsInfoBtn');
  
  if (!user) {
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (notSignedInDiv) notSignedInDiv.classList.remove('hidden');
    return;
  }

  try {
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (notSignedInDiv) notSignedInDiv.classList.add('hidden');
    
    const hasConfig = await checkOpenHandsConfig(user.uid);
    if (loadingDiv) loadingDiv.classList.add('hidden');
    
    if (hasConfig) {
      if (noConfigSection) noConfigSection.classList.add('hidden');
      if (openhandsContentSection) openhandsContentSection.classList.remove('hidden');
      if (loadBtn) loadBtn.classList.remove('hidden');
      
      await loadAndDisplayOpenHands(user);
    } else {
      if (noConfigSection) noConfigSection.classList.remove('hidden');
      if (openhandsContentSection) openhandsContentSection.classList.add('hidden');
      if (loadBtn) loadBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('OpenHands workspace load error:', err);
    if (loadingDiv) loadingDiv.classList.add('hidden');
    showToast('Failed to connect to OpenHands server: ' + err.message, 'error');
  }
}

async function loadAndDisplayOpenHands(user) {
  const conversationsList = document.getElementById('openhandsConversationsList');
  if (conversationsList) {
    conversationsList.replaceChildren();
    const loadMsg = document.createElement('div');
    loadMsg.className = 'muted-text small-text pad-sm';
    loadMsg.textContent = 'Loading conversations...';
    conversationsList.appendChild(loadMsg);
  }

  const sandboxesList = document.getElementById('openhandsSandboxesList');
  if (sandboxesList) {
    sandboxesList.replaceChildren();
    const loadMsg = document.createElement('div');
    loadMsg.className = 'muted-text small-text pad-sm';
    loadMsg.textContent = 'Loading sandboxes...';
    sandboxesList.appendChild(loadMsg);
  }

  const specsList = document.getElementById('openhandsSpecsList');
  if (specsList) {
    specsList.replaceChildren();
    const loadMsg = document.createElement('div');
    loadMsg.className = 'muted-text small-text pad-sm';
    loadMsg.textContent = 'Loading templates...';
    specsList.appendChild(loadMsg);
  }

  const config = await getDecryptedOpenHandsConfig(user.uid);
  const baseUrl = config?.baseUrl || 'http://localhost:3000';
  const data = await loadOpenHandsProfileInfo();
  
  const connErrorDiv = document.getElementById('openhandsConnectionError');
  const connErrorMessage = document.getElementById('openhandsConnectionErrorMessage');
  
  if (data.error) {
    if (connErrorDiv) connErrorDiv.classList.remove('hidden');
    if (connErrorMessage) {
      connErrorMessage.textContent = `Could not connect to OpenHands server at ${baseUrl}: ${data.error.message}. Please verify that OpenHands is running and configured correctly.`;
    }
    showToast('Failed to connect to OpenHands server', 'error');
  } else {
    if (connErrorDiv) connErrorDiv.classList.add('hidden');
  }
  
  renderConversations(data.conversations, baseUrl);
  renderSandboxes(data.sandboxes);
  renderSpecs(data.sandboxSpecs);
}

function renderConversations(conversations, baseUrl) {
  const listDiv = document.getElementById('openhandsConversationsList');
  if (!listDiv) return;

  listDiv.replaceChildren();

  if (!conversations || conversations.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'muted-text small-text pad-md';
    emptyDiv.textContent = 'No conversations found.';
    listDiv.appendChild(emptyDiv);
    return;
  }

  conversations.forEach(conv => {
    const card = document.createElement('div');
    card.className = 'session-card pad-md mb-sm';

    const id = conv.id || conv.conversation_id || '';
    const displayId = id ? id.slice(0, 8) : 'Unknown';
    const title = conv.title || conv.name || `Conversation ${displayId}`;
    const repo = conv.selected_repository || 'No repository selected';
    const status = conv.status || 'Active';
    const createdAt = conv.created_at ? new Date(conv.created_at).toLocaleString() : 'Unknown date';

    const cardRow = document.createElement('div');
    cardRow.className = 'all-sessions__card-row';

    const titleLink = document.createElement('a');
    titleLink.className = 'all-sessions__title fw-600 font-14';

    let validWebUrl = '#';
    try {
      if (id) {
        const urlObj = new URL(`/conversations/${id}`, baseUrl);
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          validWebUrl = urlObj.href;
        }
      }
    } catch (e) {
      // fallback
    }
    titleLink.href = validWebUrl;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-inline';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = 'chat';

    titleLink.appendChild(iconSpan);
    titleLink.appendChild(document.createTextNode(' ' + title));

    const statusBadge = document.createElement('span');
    statusBadge.className = 'all-sessions__status-badge font-11';
    statusBadge.textContent = status;

    cardRow.appendChild(titleLink);
    cardRow.appendChild(statusBadge);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'all-sessions__meta font-11 muted-text mt-xs';

    const repoDiv = document.createElement('div');
    const repoLabel = document.createElement('strong');
    repoLabel.textContent = 'Repository: ';
    repoDiv.appendChild(repoLabel);
    repoDiv.appendChild(document.createTextNode(repo));

    const createdDiv = document.createElement('div');
    createdDiv.className = 'mt-xxs';
    const createdLabel = document.createElement('strong');
    createdLabel.textContent = 'Created: ';
    createdDiv.appendChild(createdLabel);
    createdDiv.appendChild(document.createTextNode(createdAt));

    metaDiv.appendChild(repoDiv);
    metaDiv.appendChild(createdDiv);

    card.appendChild(cardRow);
    card.appendChild(metaDiv);

    listDiv.appendChild(card);
  });
}

function renderSandboxes(sandboxes) {
  const listDiv = document.getElementById('openhandsSandboxesList');
  if (!listDiv) return;

  listDiv.replaceChildren();

  if (!sandboxes || sandboxes.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'muted-text small-text pad-md';
    emptyDiv.textContent = 'No active sandboxes.';
    listDiv.appendChild(emptyDiv);
    return;
  }

  sandboxes.forEach(sb => {
    const card = document.createElement('div');
    card.className = 'session-card pad-sm mb-xs';

    const id = sb.id || sb.sandbox_id || '';
    const displayId = id ? id.slice(0, 12) : 'Unknown';
    const status = sb.status || 'running';
    const image = sb.image || sb.spec_id || 'default';
    const isPaused = status.toLowerCase() === 'paused';

    const leftDiv = document.createElement('div');
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'fw-600 font-12';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-inline';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = 'view_in_ar';
    titleDiv.appendChild(iconSpan);
    titleDiv.appendChild(document.createTextNode(` Sandbox: ${displayId}`));

    const metaDiv = document.createElement('div');
    metaDiv.className = 'font-11 muted-text mt-xxs';
    metaDiv.appendChild(document.createTextNode(`Image: ${image} | Status: `));
    const statusStrong = document.createElement('strong');
    statusStrong.className = 'accent-text';
    statusStrong.textContent = status.toUpperCase();
    metaDiv.appendChild(statusStrong);

    leftDiv.appendChild(titleDiv);
    leftDiv.appendChild(metaDiv);

    const rightDiv = document.createElement('div');
    const actionBtn = document.createElement('button');
    actionBtn.className = `btn sm ${isPaused ? 'primary' : 'warn'} sandbox-action-btn`;
    actionBtn.dataset.id = id;
    actionBtn.dataset.action = isPaused ? 'resume' : 'pause';

    const btnIcon = document.createElement('span');
    btnIcon.className = 'icon icon-inline';
    btnIcon.setAttribute('aria-hidden', 'true');
    btnIcon.textContent = isPaused ? 'play_arrow' : 'pause';

    actionBtn.appendChild(btnIcon);
    actionBtn.appendChild(document.createTextNode(isPaused ? ' Resume' : ' Pause'));

    rightDiv.appendChild(actionBtn);

    card.appendChild(leftDiv);
    card.appendChild(rightDiv);

    listDiv.appendChild(card);
  });

  // Attach event listeners for sandbox actions
  listDiv.querySelectorAll('.sandbox-action-btn').forEach(btn => {
    btn.onclick = async () => {
      const sandboxId = btn.dataset.id;
      const action = btn.dataset.action;
      btn.disabled = true;
      btn.textContent = action === 'resume' ? 'Resuming...' : 'Pausing...';
      
      try {
        if (action === 'resume') {
          await resumeSandbox(sandboxId);
          showToast('Sandbox resumed', 'success');
        } else {
          await pauseSandbox(sandboxId);
          showToast('Sandbox paused', 'success');
        }
        const auth = getAuth();
        if (auth?.currentUser) {
          await loadAndDisplayOpenHands(auth.currentUser);
        }
      } catch (err) {
        showToast(`Failed to ${action} sandbox: ` + err.message, 'error');
        btn.disabled = false;
        btn.replaceChildren();
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon icon-inline';
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = action === 'resume' ? 'play_arrow' : 'pause';
        btn.appendChild(iconSpan);
        btn.appendChild(document.createTextNode(action === 'resume' ? ' Resume' : ' Pause'));
      }
    };
  });
}

function renderSpecs(specs) {
  const listDiv = document.getElementById('openhandsSpecsList');
  if (!listDiv) return;

  listDiv.replaceChildren();

  if (!specs || specs.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'muted-text small-text pad-md';
    emptyDiv.textContent = 'No templates available.';
    listDiv.appendChild(emptyDiv);
    return;
  }

  specs.forEach(spec => {
    const card = document.createElement('div');
    card.className = 'panel pad-sm mb-xs';
    
    const id = spec.id || spec.spec_id || '';
    const name = spec.name || id;
    const image = spec.container_image || spec.image || '';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'fw-600 font-12';
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon icon-inline';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = 'layers';
    titleDiv.appendChild(iconSpan);
    titleDiv.appendChild(document.createTextNode(' ' + name));

    card.appendChild(titleDiv);

    if (image) {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'font-11 muted-text mt-xxs';
      imgDiv.appendChild(document.createTextNode('Image: '));
      const codeEl = document.createElement('code');
      codeEl.textContent = image;
      imgDiv.appendChild(codeEl);
      card.appendChild(imgDiv);
    }

    listDiv.appendChild(card);
  });
}

async function initApp() {
  const loadBtn = document.getElementById('loadOpenhandsInfoBtn');
  if (loadBtn) {
    loadBtn.onclick = () => {
      const auth = getAuth();
      const user = auth?.currentUser;
      if (user) {
        loadOpenHandsInfo();
      }
    };
  }

  try {
    await waitForFirebase();
    const auth = getAuth();
    auth.onAuthStateChanged((user) => {
      if (user) {
        loadOpenHandsInfo();
      } else {
        const notSignedInDiv = document.getElementById('openhandsNotSignedIn');
        if (notSignedInDiv) notSignedInDiv.classList.remove('hidden');
      }
    });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
