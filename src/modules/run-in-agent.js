/**
 * Run in Agent Module
 * Manages agent selection (Jules vs Brace) for prompt dispatch.
 */

import { OPENCLAW, AGENT_UI_TEXT } from '../utils/constants.js';
import { showToast } from './toast.js';

const AGENT_STORAGE_KEY = 'agenticQueue.lastAgent';
// Time to wait for an immediate error response from the relay before assuming
// the request is in-flight (brace is processing). 503/401 come back instantly;
// a valid dispatch hangs until brace responds (20–60s).
const BRACE_RELAY_TIMEOUT_MS = 5000;

export function getAgentOptions() {
  return [
    { value: 'jules', label: 'Jules', icon: 'smart_toy' },
    { value: 'brace', label: 'Brace', icon: 'hub' }
  ];
}

export function getLastAgent() {
  try {
    return localStorage.getItem(AGENT_STORAGE_KEY) || 'jules';
  } catch {
    return 'jules';
  }
}

export function saveLastAgent(agent) {
  try {
    localStorage.setItem(AGENT_STORAGE_KEY, agent);
  } catch {}
}

export async function dispatchToAgent(agent, payload) {
  if (agent === 'jules') {
    const { callRunJulesFunction } = await import('./jules-api.js');
    return callRunJulesFunction(payload.promptText, payload.sourceId, payload.branch, payload.title);
  } else if (agent === 'brace') {
    await _dispatchToBrace(payload.promptText);
    return;
  }
  throw new Error(`Unknown agent: ${agent}`);
}

async function _dispatchToBrace(promptText) {
  const { getAuth } = await import('./firebase-service.js');
  const auth = getAuth();
  const user = auth?.currentUser;

  if (user) {
    const { getOpenclawConfig, decryptOpenclawKey } = await import('./openclaw-keys.js');
    const config = await getOpenclawConfig(user.uid);

    if (config?.hasToken) {
      const token = await decryptOpenclawKey(user.uid);
      const baseUrl = config.useRelay ? OPENCLAW.RELAY_URL : config.gatewayUrl;

      if (token && baseUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), BRACE_RELAY_TIMEOUT_MS);

        try {
          const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              model: 'brace',
              messages: [{ role: 'user', content: promptText }],
              stream: false,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            showToast(AGENT_UI_TEXT.SENT_TO_BRACE, 'success');
            return;
          }

          const body = await res.json().catch(() => ({}));
          showToast(AGENT_UI_TEXT.BRACE_SEND_FAILED + (body.error || res.status), 'error');
          return;
        } catch (err) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            // Request is in-flight — brace is processing, which is the normal happy path
            showToast(AGENT_UI_TEXT.SENT_TO_BRACE, 'success');
            return;
          }
          showToast(AGENT_UI_TEXT.BRACE_SEND_FAILED + err.message, 'error');
          return;
        }
      }
    }
  }

  // Fallback when not configured: open brace-ui so the user can connect
  window.open(OPENCLAW.BRACE_UI_URL, '_blank', 'noopener,noreferrer');
  showToast(AGENT_UI_TEXT.SENT_TO_BRACE, 'success');
}
