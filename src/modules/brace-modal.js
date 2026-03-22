// ===== Brace Modal Module =====
// OpenClaw connection settings modal.
// Mode selector: "Use PromptRoot Relay" (default) vs "Use my own URL".

import { getAuth } from './firebase-service.js';
import { encryptAndStoreOpenclawKey, getOpenclawConfig } from './openclaw-keys.js';
import { showToast } from './toast.js';
import { OPENCLAW_UI_TEXT } from '../utils/constants.js';

let modalEl = null;
let cleanup = null;

function buildModal() {
  const modal = document.createElement('div');
  modal.id = 'braceModal';
  modal.className = 'modal';

  const content = document.createElement('div');
  content.className = 'modal-content';

  // Header
  const header = document.createElement('div');
  header.className = 'modal-header';
  const title = document.createElement('h3');
  title.textContent = 'Connect OpenClaw';
  const closeX = document.createElement('button');
  closeX.className = 'btn-icon close-modal';
  closeX.id = 'braceModalClose';
  closeX.textContent = '✕';
  closeX.title = 'Close';
  header.appendChild(title);
  header.appendChild(closeX);

  // Body
  const body = document.createElement('div');
  body.className = 'modal-body';

  // Mode selector
  const modeSection = document.createElement('div');
  modeSection.className = 'brace-mode-selector mb-md';

  const relayLabel = document.createElement('label');
  relayLabel.className = 'brace-mode-option';
  const relayRadio = document.createElement('input');
  relayRadio.type = 'radio';
  relayRadio.name = 'braceMode';
  relayRadio.value = 'relay';
  relayRadio.id = 'braceModeRelay';
  relayRadio.checked = true;
  relayLabel.appendChild(relayRadio);
  relayLabel.append(' ' + OPENCLAW_UI_TEXT.RELAY_MODE_LABEL);

  const customLabel = document.createElement('label');
  customLabel.className = 'brace-mode-option';
  const customRadio = document.createElement('input');
  customRadio.type = 'radio';
  customRadio.name = 'braceMode';
  customRadio.value = 'custom';
  customRadio.id = 'braceModeCustom';
  customLabel.appendChild(customRadio);
  customLabel.append(' ' + OPENCLAW_UI_TEXT.CUSTOM_URL_MODE_LABEL);

  modeSection.appendChild(relayLabel);
  modeSection.appendChild(customLabel);
  body.appendChild(modeSection);

  // Relay mode fields
  const relayFields = document.createElement('div');
  relayFields.id = 'braceRelayFields';

  const relayHelp = document.createElement('p');
  relayHelp.className = 'small-text muted-text mb-sm';
  relayHelp.innerHTML = 'Paste your <code>pra_...</code> agent token. ' +
    `<a href="/agent-api" target="_blank" rel="noopener" id="braceGenerateTokenLink">${OPENCLAW_UI_TEXT.GENERATE_TOKEN_LINK}</a>`;
  const relayTokenInput = document.createElement('input');
  relayTokenInput.type = 'password';
  relayTokenInput.id = 'braceRelayToken';
  relayTokenInput.className = 'input-field';
  relayTokenInput.placeholder = OPENCLAW_UI_TEXT.TOKEN_PLACEHOLDER;
  relayFields.appendChild(relayHelp);
  relayFields.appendChild(relayTokenInput);
  body.appendChild(relayFields);

  // Custom URL mode fields
  const customFields = document.createElement('div');
  customFields.id = 'braceCustomFields';
  customFields.className = 'hidden';

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.id = 'braceGatewayUrl';
  urlInput.className = 'input-field mb-sm';
  urlInput.placeholder = OPENCLAW_UI_TEXT.GATEWAY_URL_PLACEHOLDER;

  const customTokenInput = document.createElement('input');
  customTokenInput.type = 'password';
  customTokenInput.id = 'braceGatewayToken';
  customTokenInput.className = 'input-field';
  customTokenInput.placeholder = OPENCLAW_UI_TEXT.GATEWAY_TOKEN_PLACEHOLDER;

  customFields.appendChild(urlInput);
  customFields.appendChild(customTokenInput);
  body.appendChild(customFields);

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'modal-buttons';

  const saveBtn = document.createElement('button');
  saveBtn.id = 'braceSaveBtn';
  saveBtn.className = 'btn primary';
  saveBtn.textContent = OPENCLAW_UI_TEXT.SAVE_BUTTON;

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'braceCancelBtn';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = OPENCLAW_UI_TEXT.CANCEL_BUTTON;

  buttons.appendChild(saveBtn);
  buttons.appendChild(cancelBtn);

  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(buttons);
  modal.appendChild(content);
  document.body.appendChild(modal);
  return modal;
}

export async function showBraceModal(onSave) {
  if (!modalEl) modalEl = buildModal();

  const modal = modalEl;
  const relayRadio = document.getElementById('braceModeRelay');
  const customRadio = document.getElementById('braceModeCustom');
  const relayFields = document.getElementById('braceRelayFields');
  const customFields = document.getElementById('braceCustomFields');
  const relayTokenInput = document.getElementById('braceRelayToken');
  const urlInput = document.getElementById('braceGatewayUrl');
  const customTokenInput = document.getElementById('braceGatewayToken');
  const saveBtn = document.getElementById('braceSaveBtn');
  const cancelBtn = document.getElementById('braceCancelBtn');
  const closeX = document.getElementById('braceModalClose');

  // Pre-populate from existing config
  const user = getAuth()?.currentUser;
  if (user) {
    try {
      const config = await getOpenclawConfig(user.uid);
      if (config) {
        if (!config.useRelay) {
          customRadio.checked = true;
          relayFields.classList.add('hidden');
          customFields.classList.remove('hidden');
          if (config.gatewayUrl) urlInput.value = config.gatewayUrl;
        }
      }
    } catch { /* ignore */ }
  }

  // Mode toggle
  const handleModeChange = () => {
    const isRelay = relayRadio.checked;
    relayFields.classList.toggle('hidden', !isRelay);
    customFields.classList.toggle('hidden', isRelay);
  };
  relayRadio.addEventListener('change', handleModeChange);
  customRadio.addEventListener('change', handleModeChange);

  // Save
  const handleSave = async () => {
    const u = getAuth()?.currentUser;
    if (!u) { showToast('Not signed in', 'error'); return; }

    const isRelay = relayRadio.checked;

    let token, gatewayUrl;
    if (isRelay) {
      token = relayTokenInput.value.trim();
      if (!token) { showToast(OPENCLAW_UI_TEXT.TOKEN_REQUIRED, 'warn'); return; }
    } else {
      token = customTokenInput.value.trim();
      gatewayUrl = urlInput.value.trim();
      if (!token) { showToast(OPENCLAW_UI_TEXT.TOKEN_REQUIRED, 'warn'); return; }
      if (!gatewayUrl) { showToast(OPENCLAW_UI_TEXT.URL_REQUIRED, 'warn'); return; }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = OPENCLAW_UI_TEXT.SAVING;
    try {
      await encryptAndStoreOpenclawKey(token, u.uid, { useRelay: isRelay, gatewayUrl: gatewayUrl || null });
      showToast(OPENCLAW_UI_TEXT.SAVED, 'success');
      hideBraceModal();
      if (onSave) onSave();
    } catch (err) {
      showToast(OPENCLAW_UI_TEXT.SAVE_ERROR, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = OPENCLAW_UI_TEXT.SAVE_BUTTON;
    }
  };

  const handleClose = () => hideBraceModal();

  // Clean up previous listeners
  if (cleanup) cleanup();

  relayRadio.addEventListener('change', handleModeChange);
  customRadio.addEventListener('change', handleModeChange);
  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleClose);
  closeX.addEventListener('click', handleClose);

  const escHandler = (e) => { if (e.key === 'Escape') handleClose(); };
  document.addEventListener('keydown', escHandler);
  const bgHandler = (e) => { if (e.target === modal) handleClose(); };
  modal.addEventListener('click', bgHandler);

  cleanup = () => {
    relayRadio.removeEventListener('change', handleModeChange);
    customRadio.removeEventListener('change', handleModeChange);
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', handleClose);
    closeX.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', escHandler);
    modal.removeEventListener('click', bgHandler);
    cleanup = null;
  };

  modal.classList.add('show');
  relayTokenInput.focus();
}

export function hideBraceModal() {
  if (modalEl) modalEl.classList.remove('show');
  if (cleanup) cleanup();
}
