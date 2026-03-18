import { getAuth } from './firebase-service.js';
import { showToast } from './toast.js';
import { copyText } from '../utils/clipboard.js';
import { AGENT_API, AGENT_KEY_UI_TEXT, TIMEOUTS } from '../utils/constants.js';

// ===== Agent Key Management Module =====
// Handles generation, storage (via Cloud Function), and revocation of Agent API tokens.
// Tokens are generated client-side; only the SHA-256 hash is stored server-side.

const MANAGE_KEYS_URL = window.location.port === '5000'
  ? `http://${window.location.hostname}:5001/promptroot-b02a2/us-central1/manageAgentKeys`
  : 'https://us-central1-promptroot-b02a2.cloudfunctions.net/manageAgentKeys';

/**
 * Compute SHA-256 hash of a string, returned as hex.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha256Hex(str) {
  const buf = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a new agent token string (not stored — caller must handle).
 * Format: pra_ + 32 random bytes as hex.
 * @returns {string}
 */
function generateTokenString() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(AGENT_API.TOKEN_BYTES));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return AGENT_API.TOKEN_PREFIX + hex;
}

/**
 * Call the manageAgentKeys Cloud Function.
 * @param {string} idToken - Firebase ID token
 * @param {object} payload - Request payload
 * @returns {Promise<object>}
 */
async function callManageKeys(idToken, payload) {
  const response = await fetch(MANAGE_KEYS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * Initialize the agent keys page for the authenticated user.
 * @param {object} user - Firebase user object
 */
export async function initAgentKeys(user) {
  const loadingEl = document.getElementById('agentKeysLoading');
  const contentEl = document.getElementById('agentKeysContent');
  const notSignedInEl = document.getElementById('agentKeysNotSignedIn');

  if (!user) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (notSignedInEl) notSignedInEl.classList.remove('hidden');
    return;
  }

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (notSignedInEl) notSignedInEl.classList.add('hidden');
  if (contentEl) contentEl.classList.add('hidden');

  try {
    await renderAgentKeysList(user);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load agent keys:', err);
    if (loadingEl) loadingEl.classList.add('hidden');
    showToast(AGENT_KEY_UI_TEXT.LOAD_ERROR, 'error');
  }

  const generateBtn = document.getElementById('generateAgentKeyBtn');
  if (generateBtn) {
    generateBtn.onclick = () => handleGenerateClick(user);
  }
}

/**
 * Fetch and render the token list.
 * @param {object} user - Firebase user object
 */
export async function renderAgentKeysList(user) {
  const listEl = document.getElementById('agentKeysList');
  if (!listEl) return;

  listEl.textContent = '';
  const loadingItem = document.createElement('div');
  loadingItem.className = 'muted-text small-text';
  loadingItem.textContent = AGENT_KEY_UI_TEXT.LOADING;
  listEl.appendChild(loadingItem);

  const idToken = await user.getIdToken();
  const data = await callManageKeys(idToken, { action: 'list' });
  const tokens = data.tokens || [];

  listEl.textContent = '';

  if (tokens.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'muted-text small-text pad-md text-center';
    empty.textContent = AGENT_KEY_UI_TEXT.NO_TOKENS;
    listEl.appendChild(empty);
    return;
  }

  tokens.forEach(token => {
    listEl.appendChild(buildTokenRow(token, user));
  });
}

/**
 * Build a DOM row for a single token entry.
 * @param {object} token - Token metadata { tokenHash, label, createdAt, lastUsedAt }
 * @param {object} user - Firebase user
 * @returns {HTMLElement}
 */
function buildTokenRow(token, user) {
  const row = document.createElement('div');
  row.className = 'agent-key-row';
  row.dataset.hash = token.tokenHash;

  const info = document.createElement('div');
  info.className = 'agent-key-info';

  const label = document.createElement('div');
  label.className = 'agent-key-label fw-600';
  label.textContent = token.label || '(unlabeled)';

  const meta = document.createElement('div');
  meta.className = 'agent-key-meta muted-text small-text';

  const createdStr = token.createdAt
    ? AGENT_KEY_UI_TEXT.CREATED_AT(new Date(token.createdAt).toLocaleDateString())
    : '';
  const usedStr = token.lastUsedAt
    ? AGENT_KEY_UI_TEXT.LAST_USED(new Date(token.lastUsedAt).toLocaleDateString())
    : AGENT_KEY_UI_TEXT.NEVER_USED;

  meta.textContent = [createdStr, usedStr].filter(Boolean).join(' · ');

  info.appendChild(label);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'agent-key-actions';

  const revokeBtn = document.createElement('button');
  revokeBtn.className = 'btn sm danger';
  revokeBtn.textContent = AGENT_KEY_UI_TEXT.REVOKE_BTN;
  revokeBtn.onclick = () => handleRevokeClick(token.tokenHash, token.label, user);

  actions.appendChild(revokeBtn);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

/**
 * Handle the generate token button click.
 * @param {object} user
 */
async function handleGenerateClick(user) {
  const labelInput = document.getElementById('agentKeyLabelInput');
  const label = labelInput ? labelInput.value.trim() : '';

  if (!label) {
    showToast(AGENT_KEY_UI_TEXT.LABEL_REQUIRED, 'warn');
    if (labelInput) labelInput.focus();
    return;
  }

  const generateBtn = document.getElementById('generateAgentKeyBtn');
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
  }

  try {
    const token = generateTokenString();
    const tokenHash = await sha256Hex(token);
    const idToken = await user.getIdToken();

    await callManageKeys(idToken, { action: 'create', tokenHash, label });

    if (labelInput) labelInput.value = '';

    // Show the token once
    showGeneratedToken(token);

    // Refresh list
    await renderAgentKeysList(user);
  } catch (err) {
    console.error('Failed to generate token:', err);
    showToast(AGENT_KEY_UI_TEXT.GENERATE_ERROR, 'error');
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = AGENT_KEY_UI_TEXT.GENERATE_BTN;
    }
  }
}

/**
 * Display the generated token in a one-time reveal panel.
 * @param {string} token
 */
function showGeneratedToken(token) {
  const panel = document.getElementById('generatedTokenPanel');
  const tokenEl = document.getElementById('generatedTokenValue');
  const copyBtn = document.getElementById('copyGeneratedTokenBtn');

  if (!panel || !tokenEl) return;

  tokenEl.textContent = token;
  panel.classList.remove('hidden');

  if (copyBtn) {
    copyBtn.onclick = async () => {
      const ok = await copyText(token);
      if (ok) {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = AGENT_KEY_UI_TEXT.COPY_TOKEN; }, TIMEOUTS.copyFeedback);
      }
    };
  }

  const dismissBtn = document.getElementById('dismissGeneratedTokenBtn');
  if (dismissBtn) {
    dismissBtn.onclick = () => panel.classList.add('hidden');
  }
}

/**
 * Handle the revoke button click.
 * @param {string} tokenHash
 * @param {string} label
 * @param {object} user
 */
async function handleRevokeClick(tokenHash, label, user) {
  if (!confirm(AGENT_KEY_UI_TEXT.REVOKE_CONFIRM)) return;

  const row = document.querySelector(`.agent-key-row[data-hash="${tokenHash}"]`);
  if (row) row.style.opacity = '0.5';

  try {
    const idToken = await user.getIdToken();
    await callManageKeys(idToken, { action: 'revoke', tokenHash });
    showToast(AGENT_KEY_UI_TEXT.TOKEN_REVOKED, 'success');
    await renderAgentKeysList(user);
  } catch (err) {
    console.error('Failed to revoke token:', err);
    if (row) row.style.opacity = '';
    showToast(AGENT_KEY_UI_TEXT.REVOKE_ERROR, 'error');
  }
}
