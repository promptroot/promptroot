// ===== OpenClaw Settings Page =====

import { initializeSharedComponents } from '../shared-init.js';
import { getAuth, getDb } from '../modules/firebase-service.js';
import { getOpenclawConfig, encryptAndStoreOpenclawKey, deleteStoredOpenclawKey } from '../modules/openclaw-keys.js';
import { showToast } from '../modules/toast.js';
import { OPENCLAW_UI_TEXT } from '../utils/constants.js';

initializeSharedComponents('openclaw');

const auth = getAuth();
if (auth) {
  auth.onAuthStateChanged(async (user) => {
    const loadingEl = document.getElementById('openclawLoading');
    const notSignedInEl = document.getElementById('openclawNotSignedIn');
    const contentEl = document.getElementById('openclawContent');

    if (!user) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (notSignedInEl) notSignedInEl.classList.remove('hidden');
      return;
    }

    await initOpenclawPage(user);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
  });
}

async function initOpenclawPage(user) {
  const relayRadio = document.getElementById('openclawModeRelay');
  const customRadio = document.getElementById('openclawModeCustom');
  const relayFields = document.getElementById('openclawRelayFields');
  const customFields = document.getElementById('openclawCustomFields');
  const relayTokenInput = document.getElementById('openclawRelayToken');
  const urlInput = document.getElementById('openclawGatewayUrl');
  const tokenInput = document.getElementById('openclawGatewayToken');
  const saveBtn = document.getElementById('openclawSaveBtn');
  const statusEl = document.getElementById('openclawStatus');
  const statusDetail = document.getElementById('openclawStatusDetail');
  const editBtn = document.getElementById('openclawEditBtn');
  const deleteBtn = document.getElementById('openclawDeleteBtn');
  const formEl = document.getElementById('openclawForm');

  // Mode toggle
  const updateMode = () => {
    const isRelay = relayRadio.checked;
    relayFields.classList.toggle('hidden', !isRelay);
    customFields.classList.toggle('hidden', isRelay);
  };
  relayRadio.addEventListener('change', updateMode);
  customRadio.addEventListener('change', updateMode);

  // Subscribe to live relay status
  const db = getDb();
  if (db) {
    db.doc(`relayStatus/${user.uid}`).onSnapshot((snap) => {
      const relayStatusEl = document.getElementById('openclawRelayStatus');
      if (!relayStatusEl) return;
      if (!snap.exists) {
        relayStatusEl.textContent = '';
        relayStatusEl.className = 'small-text muted-text mt-xs';
      } else if (snap.data().connected) {
        relayStatusEl.textContent = '● Relay connected';
        relayStatusEl.className = 'small-text color-success mt-xs';
      } else {
        relayStatusEl.textContent = '● Relay offline — start the OpenClaw gateway to connect';
        relayStatusEl.className = 'small-text color-warning mt-xs';
      }
    });
  }

  // Load existing config
  try {
    const config = await getOpenclawConfig(user.uid);
    if (config && config.hasToken) {
      if (statusEl) statusEl.classList.remove('hidden');
      if (formEl) formEl.classList.add('hidden');
      if (statusDetail) {
        statusDetail.textContent = config.useRelay
          ? 'Mode: PromptRoot Relay'
          : `Mode: Custom URL — ${config.gatewayUrl || '(no URL set)'}`;
      }
    }
  } catch { /* show form by default */ }

  // Edit button shows form
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (statusEl) statusEl.classList.add('hidden');
      if (formEl) formEl.classList.remove('hidden');
    });
  }

  // Delete / disconnect
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(OPENCLAW_UI_TEXT.DELETE_CONFIRM)) return;
      try {
        await deleteStoredOpenclawKey(user.uid);
        showToast(OPENCLAW_UI_TEXT.DELETED, 'success');
        if (statusEl) statusEl.classList.add('hidden');
        if (formEl) formEl.classList.remove('hidden');
      } catch {
        showToast(OPENCLAW_UI_TEXT.SAVE_ERROR, 'error');
      }
    });
  }

  // Save
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const isRelay = relayRadio.checked;
      let token, gatewayUrl;

      if (isRelay) {
        token = relayTokenInput ? relayTokenInput.value.trim() : '';
        if (!token) { showToast(OPENCLAW_UI_TEXT.TOKEN_REQUIRED, 'warn'); return; }
      } else {
        token = tokenInput ? tokenInput.value.trim() : '';
        gatewayUrl = urlInput ? urlInput.value.trim() : '';
        if (!token) { showToast(OPENCLAW_UI_TEXT.TOKEN_REQUIRED, 'warn'); return; }
        if (!gatewayUrl) { showToast(OPENCLAW_UI_TEXT.URL_REQUIRED, 'warn'); return; }
      }

      saveBtn.disabled = true;
      saveBtn.textContent = OPENCLAW_UI_TEXT.SAVING;
      try {
        await encryptAndStoreOpenclawKey(token, user.uid, { useRelay: isRelay, gatewayUrl: gatewayUrl || null });
        showToast(OPENCLAW_UI_TEXT.SAVED, 'success');
        if (statusEl) {
          statusEl.classList.remove('hidden');
          if (statusDetail) {
            statusDetail.textContent = isRelay
              ? 'Mode: PromptRoot Relay'
              : `Mode: Custom URL — ${gatewayUrl}`;
          }
        }
        if (formEl) formEl.classList.add('hidden');
      } catch {
        showToast(OPENCLAW_UI_TEXT.SAVE_ERROR, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = OPENCLAW_UI_TEXT.SAVE_BUTTON;
      }
    });
  }
}
