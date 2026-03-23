/**
 * Run in Agent Module
 * Manages agent selection (Jules vs Brace) for prompt dispatch.
 */

import { AGENT_UI_TEXT } from '../utils/constants.js';

const AGENT_STORAGE_KEY = 'agenticQueue.lastAgent';

export async function isBraceConfigured(uid) {
  const { getOpenclawConfig } = await import('./openclaw-keys.js');
  const config = await getOpenclawConfig(uid);
  return !!config;
}

export function getAgentOptions(braceEnabled) {
  return [
    { value: 'jules', label: 'Jules', icon: 'smart_toy' },
    {
      value: 'brace',
      label: braceEnabled ? 'Brace' : AGENT_UI_TEXT.BRACE_NOT_CONFIGURED,
      icon: 'hub',
      disabled: !braceEnabled
    }
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
    const { sendToBrace } = await import('./openclaw-api.js');
    return sendToBrace(payload.promptText, payload.title);
  }
  throw new Error(`Unknown agent: ${agent}`);
}
