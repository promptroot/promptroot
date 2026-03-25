// ===== Brace Response Panel Module =====
// Shows Brace's response below the prompt viewer.
// States: pending, complete, error, timeout.
// Polls every 3s, times out at 5 minutes.
// jobId stored in sessionStorage to resume across panel closes.

import { copyText } from '../utils/clipboard.js';
import { OPENCLAW, OPENCLAW_UI_TEXT } from '../utils/constants.js';

let panelEl = null;
let pollTimer = null;
let timeoutTimer = null;

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'braceResponsePanel';
  panel.className = 'brace-panel hidden';

  const header = document.createElement('div');
  header.className = 'brace-panel__header';

  const titleEl = document.createElement('span');
  titleEl.className = 'brace-panel__title fw-600';
  titleEl.textContent = '🦞 Brace Response';

  const headerActions = document.createElement('div');
  headerActions.className = 'brace-panel__header-actions';

  const copyBtn = document.createElement('button');
  copyBtn.id = 'bracePanelCopyBtn';
  copyBtn.className = 'btn sm hidden';
  copyBtn.textContent = OPENCLAW_UI_TEXT.COPY_RESPONSE;

  const closeBtn = document.createElement('button');
  closeBtn.id = 'bracePanelCloseBtn';
  closeBtn.className = 'btn sm';
  closeBtn.textContent = OPENCLAW_UI_TEXT.CLOSE_PANEL;

  headerActions.appendChild(copyBtn);
  headerActions.appendChild(closeBtn);
  header.appendChild(titleEl);
  header.appendChild(headerActions);

  const body = document.createElement('div');
  body.id = 'bracePanelBody';
  body.className = 'brace-panel__body';

  panel.appendChild(header);
  panel.appendChild(body);

  // Insert after the actions bar or append to main content area
  const actionsEl = document.getElementById('actions');
  if (actionsEl && actionsEl.parentNode) {
    actionsEl.parentNode.insertBefore(panel, actionsEl.nextSibling);
  } else {
    document.body.appendChild(panel);
  }

  return panel;
}

function getPanel() {
  if (!panelEl) panelEl = buildPanel();
  return panelEl;
}

function setStatus(status, output = '') {
  const body = document.getElementById('bracePanelBody');
  const copyBtn = document.getElementById('bracePanelCopyBtn');
  if (!body) return;

  body.className = `brace-panel__body brace-panel__body--${status}`;
  body.innerHTML = '';

  if (status === 'pending') {
    const spinner = document.createElement('div');
    spinner.className = 'brace-spinner';
    const msg = document.createElement('span');
    msg.className = 'muted-text small-text';
    msg.textContent = OPENCLAW_UI_TEXT.PENDING;
    body.appendChild(spinner);
    body.appendChild(msg);
    if (copyBtn) copyBtn.classList.add('hidden');

  } else if (status === 'complete') {
    const rendered = document.createElement('div');
    rendered.className = 'brace-output markdown-body';
    // Sanitize with DOMPurify if available, else use textContent
    if (window.DOMPurify && window.marked) {
      rendered.innerHTML = window.DOMPurify.sanitize(window.marked.parse(output, { breaks: true }));
    } else {
      const pre = document.createElement('pre');
      pre.textContent = output;
      rendered.appendChild(pre);
    }
    body.appendChild(rendered);
    if (copyBtn) {
      copyBtn.classList.remove('hidden');
      copyBtn.onclick = async () => {
        await copyText(output);
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = orig; }, 2000);
      };
    }

  } else if (status === 'timeout') {
    const msg = document.createElement('p');
    msg.className = 'muted-text';
    msg.textContent = OPENCLAW_UI_TEXT.TIMEOUT_MSG;
    body.appendChild(msg);
    if (copyBtn) copyBtn.classList.add('hidden');

  } else if (status === 'error') {
    const msg = document.createElement('p');
    msg.className = 'error-text';
    msg.textContent = output || OPENCLAW_UI_TEXT.ERROR_GENERIC;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn sm mt-sm';
    retryBtn.textContent = 'Retry';
    retryBtn.onclick = () => {
      // Trigger from the braceBtn
      const braceBtn = document.getElementById('braceBtn');
      if (braceBtn) braceBtn.click();
    };
    body.appendChild(msg);
    body.appendChild(retryBtn);
    if (copyBtn) copyBtn.classList.add('hidden');
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
}

export function showPanel(jobId, promptSlug = null) {
  const panel = getPanel();
  panel.classList.remove('hidden');

  const closeBtn = document.getElementById('bracePanelCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = () => hidePanel();
  }

  stopPolling();
  setStatus('pending');

  // Store jobId in sessionStorage for resume on re-open
  if (promptSlug) {
    const entry = { jobId, startedAt: Date.now() };
    sessionStorage.setItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug, JSON.stringify(entry));
  }

  startPolling(jobId, promptSlug);
}

function startPolling(jobId, promptSlug) {
  // Timeout after 5 minutes
  timeoutTimer = setTimeout(() => {
    stopPolling();
    setStatus('timeout');
    resetBraceBtn();
  }, OPENCLAW.POLL_TIMEOUT_MS);

  const poll = async () => {
    try {
      const { pollBraceJob } = await import('./openclaw-api.js');
      const result = await pollBraceJob(jobId);

      if (result.status === 'complete') {
        stopPolling();
        setStatus('complete', result.output || '');
        resetBraceBtn();
        // Clear sessionStorage entry
        if (promptSlug) sessionStorage.removeItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug);

      } else if (result.status === 'error') {
        stopPolling();
        setStatus('error', result.output || OPENCLAW_UI_TEXT.ERROR_GENERIC);
        resetBraceBtn();
        if (promptSlug) sessionStorage.removeItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug);

      } else if (result.status === 'not_found') {
        stopPolling();
        setStatus('error', OPENCLAW_UI_TEXT.RESULT_EXPIRED);
        resetBraceBtn();
        if (promptSlug) sessionStorage.removeItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug);
      }
      // pending: keep polling
    } catch (err) {
      // Network error — keep trying until timeout
      console.error('Brace poll error:', err);
    }
  };

  poll(); // immediate first poll
  pollTimer = setInterval(poll, OPENCLAW.POLL_INTERVAL_MS);
}

export function hidePanel() {
  stopPolling();
  if (panelEl) panelEl.classList.add('hidden');
  resetBraceBtn();
}

function resetBraceBtn() {
  const braceBtn = document.getElementById('braceBtn');
  if (braceBtn) {
    braceBtn.disabled = false;
    braceBtn.textContent = '';
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'bug_report';
    braceBtn.appendChild(icon);
    braceBtn.append(' Run in Brace');
  }
}

/**
 * Check sessionStorage for a resumable job for the given slug.
 * Returns { jobId } if found and within 24h TTL, else null.
 */
export function getResumableJob(promptSlug) {
  if (!promptSlug) return null;
  try {
    const raw = sessionStorage.getItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug);
    if (!raw) return null;
    const { jobId, startedAt } = JSON.parse(raw);
    if (Date.now() - startedAt > OPENCLAW.JOB_TTL_MS) {
      sessionStorage.removeItem(OPENCLAW.SESSION_KEY_PREFIX + promptSlug);
      return null;
    }
    return { jobId };
  } catch {
    return null;
  }
}
