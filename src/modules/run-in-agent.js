/**
 * Run in Agent Module
 * Manages agent selection (Jules vs Brace) for prompt dispatch.
 */

import { OPENCLAW, AGENT_UI_TEXT } from '../utils/constants.js';
import { showToast } from './toast.js';

const AGENT_STORAGE_KEY = 'agenticQueue.lastAgent';

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
    window.open(OPENCLAW.BRACE_UI_URL + '/?q=' + encodeURIComponent(payload.promptText), '_blank', 'noopener,noreferrer');
    showToast(AGENT_UI_TEXT.SENT_TO_BRACE, 'success');
    return;
  }
  throw new Error(`Unknown agent: ${agent}`);
}
