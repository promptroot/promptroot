import { initializeSharedComponents } from '../shared-init.js';
import { authorizeDevice } from '../modules/wiki-api.js';
import { getAuth } from '../modules/firebase-service.js';

const USER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function $(id) { return document.getElementById(id); }

function setStatus(message, level) {
  const el = $('authDeviceStatus');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.dataset.level = level || 'info';
}

function clearStatus() {
  const el = $('authDeviceStatus');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
  delete el.dataset.level;
}

function readUserCodeFromUrl() {
  try {
    const params = new URL(window.location.href).searchParams;
    const code = params.get('code') || params.get('user_code');
    if (code) return code.trim().toUpperCase();
  } catch { /* ignore */ }
  return '';
}

function normalizeInput(value) {
  return String(value || '').trim().toUpperCase();
}

function autoInsertHyphen(input) {
  let v = input.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9-]/g, '');
  if (v.length > 4 && v[4] !== '-') {
    v = `${v.slice(0, 4)}-${v.slice(4, 8)}`;
  }
  if (v.length > 9) v = v.slice(0, 9);
  input.value = v;
}

async function ensureSignedIn() {
  const auth = getAuth();
  if (auth?.currentUser) return auth.currentUser;

  const provider = new firebase.auth.GithubAuthProvider();
  provider.addScope('public_repo');

  try {
    // Prefer popup for fast completion on desktop browsers.
    await auth.signInWithPopup(provider);
  } catch (err) {
    // Popup can fail with auth/internal-error in restricted browser contexts.
    // Redirect flow is more reliable and returns to this same page.
    console.error('auth-device popup sign-in failed, falling back to redirect:', err);
    setStatus('Completing sign-in via redirect. Return to this page to authorize.', 'info');
    await auth.signInWithRedirect(provider);
    return null;
  }

  if (auth?.currentUser) {
    return auth.currentUser;
  }

  setStatus('Sign in is required to authorize this device. Please complete GitHub sign-in and try again.', 'error');
  return null;
}

async function submit(userCode) {
  const submitBtn = $('authDeviceSubmit');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const result = await authorizeDevice(userCode);
    const label = result?.deviceLabel ? ` (${result.deviceLabel})` : '';
    setStatus(`Device authorized${label}. You can return to the CLI.`, 'success');
  } catch (err) {
    setStatus(err.message || 'Authorization failed', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function bind() {
  const form = $('authDeviceForm');
  const input = $('authDeviceCodeInput');
  if (!form || !input) return;

  const prefilled = readUserCodeFromUrl();
  if (prefilled) input.value = prefilled;

  input.addEventListener('input', () => autoInsertHyphen(input));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus();
    const userCode = normalizeInput(input.value);
    if (!USER_CODE_RE.test(userCode)) {
      setStatus('Code must be 4 characters, a hyphen, then 4 more (e.g. WDJB-MJHT).', 'error');
      return;
    }
    const user = await ensureSignedIn();
    if (!user) return;
    await submit(userCode);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeSharedComponents('auth-device');
  bind();
});
