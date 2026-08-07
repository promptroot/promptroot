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
  const sandboxesList = document.getElementById('openhandsSandboxesList');
  const specsList = document.getElementById('openhandsSpecsList');

  if (conversationsList) conversationsList.innerHTML = '<div class="muted-text small-text pad-sm">Loading conversations...</div>';
  if (sandboxesList) sandboxesList.innerHTML = '<div class="muted-text small-text pad-sm">Loading sandboxes...</div>';
  if (specsList) specsList.innerHTML = '<div class="muted-text small-text pad-sm">Loading templates...</div>';

  const config = await getDecryptedOpenHandsConfig(user.uid);
  const data = await loadOpenHandsProfileInfo();
  
  const connErrorDiv = document.getElementById('openhandsConnectionError');
  const connErrorMessage = document.getElementById('openhandsConnectionErrorMessage');
  
  if (data.error) {
    if (connErrorDiv) connErrorDiv.classList.remove('hidden');
    if (connErrorMessage) {
      connErrorMessage.textContent = `Could not connect to OpenHands server at ${config.baseUrl}: ${data.error.message}. Please verify that OpenHands is running and configured correctly.`;
    }
    showToast('Failed to connect to OpenHands server', 'error');
  } else {
    if (connErrorDiv) connErrorDiv.classList.add('hidden');
  }
  
  renderConversations(data.conversations, config.baseUrl);
  renderSandboxes(data.sandboxes);
  renderSpecs(data.sandboxSpecs);
}

function renderConversations(conversations, baseUrl) {
  const listDiv = document.getElementById('openhandsConversationsList');
  if (!listDiv) return;

  if (!conversations || conversations.length === 0) {
    listDiv.innerHTML = '<div class="muted-text small-text pad-md">No conversations found.</div>';
    return;
  }

  listDiv.innerHTML = '';
  conversations.forEach(conv => {
    const card = document.createElement('div');
    card.className = 'session-card pad-md mb-sm';
    
    const id = conv.id || conv.conversation_id;
    const title = conv.title || conv.name || `Conversation ${id.slice(0, 8)}`;
    const repo = conv.selected_repository || 'No repository selected';
    const status = conv.status || 'Active';
    const createdAt = conv.created_at ? new Date(conv.created_at).toLocaleString() : 'Unknown date';
    const webUrl = `${baseUrl}/conversations/${id}`;

    card.innerHTML = `
      <div class="all-sessions__card-row">
        <a href="${webUrl}" target="_blank" rel="noopener" class="all-sessions__title fw-600 font-14">
          <span class="icon icon-inline" aria-hidden="true">chat</span> ${DOMPurify.sanitize(title)}
        </a>
        <span class="all-sessions__status-badge font-11">${DOMPurify.sanitize(status)}</span>
      </div>
      <div class="all-sessions__meta font-11 muted-text mt-xs">
        <div><strong>Repository:</strong> ${DOMPurify.sanitize(repo)}</div>
        <div class="mt-xxs"><strong>Created:</strong> ${createdAt}</div>
      </div>
    `;
    listDiv.appendChild(card);
  });
}

function renderSandboxes(sandboxes) {
  const listDiv = document.getElementById('openhandsSandboxesList');
  if (!listDiv) return;

  if (!sandboxes || sandboxes.length === 0) {
    listDiv.innerHTML = '<div class="muted-text small-text pad-md">No active sandboxes.</div>';
    return;
  }

  listDiv.innerHTML = '';
  sandboxes.forEach(sb => {
    const card = document.createElement('div');
    card.className = 'session-card pad-sm mb-xs';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    
    const id = sb.id || sb.sandbox_id;
    const status = sb.status || 'running';
    const image = sb.image || sb.spec_id || 'default';
    const isPaused = status.toLowerCase() === 'paused';

    const cleanImage = DOMPurify.sanitize(image);
    const cleanId = DOMPurify.sanitize(id);

    card.innerHTML = `
      <div>
        <div class="fw-600 font-12"><span class="icon icon-inline" aria-hidden="true">view_in_ar</span> Sandbox: ${cleanId.slice(0, 12)}</div>
        <div class="font-11 muted-text mt-xxs">Image: ${cleanImage} | Status: <strong class="accent-text">${status.toUpperCase()}</strong></div>
      </div>
      <div>
        <button class="btn sm ${isPaused ? 'primary' : 'warn'} sandbox-action-btn" data-id="${cleanId}" data-action="${isPaused ? 'resume' : 'pause'}">
          <span class="icon icon-inline" aria-hidden="true">${isPaused ? 'play_arrow' : 'pause'}</span>
          ${isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    `;
    listDiv.appendChild(card);
  });

  // Attach event listeners for sandbox actions
  listDiv.querySelectorAll('.sandbox-action-btn').forEach(btn => {
    btn.onclick = async (e) => {
      const sandboxId = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
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
        btn.innerHTML = `
          <span class="icon icon-inline" aria-hidden="true">${action === 'resume' ? 'play_arrow' : 'pause'}</span>
          ${action === 'resume' ? 'Resume' : 'Pause'}
        `;
      }
    };
  });
}

function renderSpecs(specs) {
  const listDiv = document.getElementById('openhandsSpecsList');
  if (!listDiv) return;

  if (!specs || specs.length === 0) {
    listDiv.innerHTML = '<div class="muted-text small-text pad-md">No templates available.</div>';
    return;
  }

  listDiv.innerHTML = '';
  specs.forEach(spec => {
    const card = document.createElement('div');
    card.className = 'panel pad-sm mb-xs';
    
    const id = spec.id || spec.spec_id;
    const name = spec.name || id;
    const image = spec.container_image || spec.image || '';

    card.innerHTML = `
      <div class="fw-600 font-12"><span class="icon icon-inline" aria-hidden="true">layers</span> ${DOMPurify.sanitize(name)}</div>
      ${image ? `<div class="font-11 muted-text mt-xxs">Image: <code>${DOMPurify.sanitize(image)}</code></div>` : ''}
    `;
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
