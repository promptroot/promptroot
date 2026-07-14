// ===== OpenCode Page =====

import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { getOpencodeConfig } from '../modules/opencode-keys.js';
import { showOpencodeModal } from '../modules/opencode-modal.js';

initializeSharedComponents('opencode');

const auth = getAuth();
if (auth) {
  auth.onAuthStateChanged(async (user) => {
    const loadingEl = document.getElementById('opencodeLoading');
    const notSignedInEl = document.getElementById('opencodeNotSignedIn');
    const contentEl = document.getElementById('opencodeContent');

    if (!user) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (notSignedInEl) notSignedInEl.classList.remove('hidden');
      return;
    }

    await initOpencodePage(user);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
  });
}

async function initOpencodePage(user) {
  const statusIconEl = document.getElementById('opencodeStatusIcon');
  const statusTitleEl = document.getElementById('opencodeStatusTitle');
  const statusDetailEl = document.getElementById('opencodeStatusDetail');
  const configureBtn = document.getElementById('configureOpencodeBtn');

  const updateUI = async () => {
    const config = await getOpencodeConfig(user.uid);
    const isConfigured = !!(config && config.gatewayUrl);

    if (statusIconEl) {
      statusIconEl.textContent = isConfigured ? 'check_circle' : 'radio_button_unchecked';
      statusIconEl.className = `icon icon-lg ${isConfigured ? 'color-success' : 'color-muted'}`;
    }
    if (statusTitleEl) {
      statusTitleEl.textContent = isConfigured ? 'OpenCode Configured' : 'Not configured';
      statusTitleEl.className = isConfigured ? 'opencode-detect-status__title' : 'opencode-detect-status__title color-muted';
    }
    if (statusDetailEl) {
      statusDetailEl.textContent = isConfigured
        ? `Endpoint: ${config.gatewayUrl}`
        : 'Set up your local server endpoint.';
    }
  };

  await updateUI();

  if (configureBtn) {
    configureBtn.onclick = () => {
      showOpencodeModal(async () => {
        await updateUI();
      });
    };
  }
}
