// ===== OpenClaw Page =====

import { initializeSharedComponents } from '../shared-init.js';
import { getAuth, getDb } from '../modules/firebase-service.js';
import { getOpenclawConfig } from '../modules/openclaw-keys.js';

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
  const statusIconEl = document.getElementById('openclawStatusIcon');
  const statusTitleEl = document.getElementById('openclawStatusTitle');
  const statusDetailEl = document.getElementById('openclawStatusDetail');
  const relayStatusEl = document.getElementById('openclawRelayStatus');

  const config = await getOpenclawConfig(user.uid);
  const isConfigured = !!(config && config.hasToken);

  if (statusIconEl) {
    statusIconEl.textContent = isConfigured ? 'check_circle' : 'radio_button_unchecked';
    statusIconEl.className = `icon icon-lg ${isConfigured ? 'color-success' : 'color-muted'}`;
  }
  if (statusTitleEl) {
    statusTitleEl.textContent = isConfigured ? 'OpenClaw Connected' : 'Not configured';
    statusTitleEl.className = isConfigured ? 'openclaw-detect-status__title' : 'openclaw-detect-status__title color-muted';
  }
  if (statusDetailEl) {
    statusDetailEl.textContent = isConfigured
      ? `Token: ${config.tokenLabel || 'OpenClaw token'}`
      : 'Set up on your profile page.';
  }

  // Live relay status
  const db = getDb();
  if (db && isConfigured && relayStatusEl) {
    db.doc(`relayStatus/${user.uid}`).onSnapshot((snap) => {
      if (!snap.exists) {
        relayStatusEl.textContent = '';
      } else if (snap.data().connected) {
        relayStatusEl.textContent = '● Relay connected';
        relayStatusEl.className = 'small-text color-success mt-xs';
      } else {
        relayStatusEl.textContent = '● Relay offline — start the OpenClaw gateway to connect';
        relayStatusEl.className = 'small-text color-warning mt-xs';
      }
    });
  }
}
