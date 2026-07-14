import { getAuth } from './firebase-service.js';
import { encryptAndStoreOpencodeKey, getOpencodeConfig } from './opencode-keys.js';
import { showToast } from './toast.js';
import { OPENCODE_UI_TEXT } from '../utils/constants.js';

// ===== OpenCode Modal Module =====
// Settings modal for local/remote OpenCode serve integration.

let modalEl = null;
let cleanup = null;

function buildModal() {
  const modal = document.createElement('div');
  modal.id = 'opencodeModal';
  modal.className = 'modal';

  const content = document.createElement('div');
  content.className = 'modal-content';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h3');
  title.textContent = 'Connect OpenCode';
  const closeX = document.createElement('button');
  closeX.className = 'btn-icon close-modal';
  closeX.id = 'opencodeModalClose';
  closeX.textContent = '✕';
  closeX.title = 'Close';
  header.appendChild(title);
  header.appendChild(closeX);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  const infoText = document.createElement('p');
  infoText.className = 'small-text muted-text mb-sm';
  infoText.innerHTML = 'Configure your local OpenCode headless server connection. Start the server with:<br/>' +
    '<code>opencode serve --cors http://localhost:3000</code>';
  body.appendChild(infoText);

  // Endpoint URL Field
  const urlLabel = document.createElement('label');
  urlLabel.className = 'section-label mb-xs';
  urlLabel.textContent = 'Server URL';
  body.appendChild(urlLabel);

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.id = 'opencodeGatewayUrl';
  urlInput.className = 'input-field mb-sm';
  urlInput.placeholder = OPENCODE_UI_TEXT.GATEWAY_URL_PLACEHOLDER;
  body.appendChild(urlInput);

  // Token Field
  const tokenLabel = document.createElement('label');
  tokenLabel.className = 'section-label mb-xs';
  tokenLabel.textContent = 'Server Password / Token';
  body.appendChild(tokenLabel);

  const customTokenInput = document.createElement('input');
  customTokenInput.type = 'password';
  customTokenInput.id = 'opencodeGatewayToken';
  customTokenInput.className = 'input-field';
  customTokenInput.placeholder = OPENCODE_UI_TEXT.GATEWAY_TOKEN_PLACEHOLDER;
  body.appendChild(customTokenInput);

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'modal-buttons';

  const saveBtn = document.createElement('button');
  saveBtn.id = 'opencodeSaveBtn';
  saveBtn.className = 'btn primary';
  saveBtn.textContent = OPENCODE_UI_TEXT.SAVE_BUTTON;

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'opencodeCancelBtn';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = OPENCODE_UI_TEXT.CANCEL_BUTTON;

  buttons.appendChild(saveBtn);
  buttons.appendChild(cancelBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(buttons);
  modal.appendChild(content);
  document.body.appendChild(modal);
  return modal;
}

export async function showOpencodeModal(onSave) {
  if (!modalEl) modalEl = buildModal();

  const modal = modalEl;
  const urlInput = document.getElementById('opencodeGatewayUrl');
  const customTokenInput = document.getElementById('opencodeGatewayToken');
  const saveBtn = document.getElementById('opencodeSaveBtn');
  const cancelBtn = document.getElementById('opencodeCancelBtn');
  const closeX = document.getElementById('opencodeModalClose');

  // Pre-populate from existing config
  const user = getAuth()?.currentUser;
  if (user) {
    try {
      const config = await getOpencodeConfig(user.uid);
      if (config) {
        if (config.gatewayUrl) urlInput.value = config.gatewayUrl;
      }
    } catch { /* ignore */ }
  }

  // Save
  const handleSave = async () => {
    const u = getAuth()?.currentUser;
    if (!u) { showToast('Not signed in', 'error'); return; }

    const token = customTokenInput.value.trim();
    const gatewayUrl = urlInput.value.trim();
    if (!gatewayUrl) { showToast(OPENCODE_UI_TEXT.URL_REQUIRED, 'warn'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = OPENCODE_UI_TEXT.SAVING;
    try {
      await encryptAndStoreOpencodeKey(token || null, u.uid, { gatewayUrl });
      showToast(OPENCODE_UI_TEXT.SAVED, 'success');
      hideOpencodeModal();
      if (onSave) onSave();
    } catch (err) {
      showToast(OPENCODE_UI_TEXT.SAVE_ERROR, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = OPENCODE_UI_TEXT.SAVE_BUTTON;
    }
  };

  const handleClose = () => hideOpencodeModal();

  // Clean up previous listeners
  if (cleanup) cleanup();

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleClose);
  closeX.addEventListener('click', handleClose);

  const escHandler = (e) => { if (e.key === 'Escape') handleClose(); };
  document.addEventListener('keydown', escHandler);
  const bgHandler = (e) => { if (e.target === modal) handleClose(); };
  modal.addEventListener('click', bgHandler);

  cleanup = () => {
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleClose);
    closeX.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', escHandler);
    modal.removeEventListener('click', bgHandler);
    cleanup = null;
  };

  modal.classList.add('show');
  urlInput.focus();
}

export function hideOpencodeModal() {
  if (modalEl) modalEl.classList.remove('show');
  if (cleanup) cleanup();
}
