import { getAuth } from './firebase-service.js';

// ===== OpenClaw API Module =====
// Wrappers for the callOpenclawGateway and pollOpenclawJob Cloud Functions.

const BASE_URL = window.location.port === '5000'
  ? `http://${window.location.hostname}:5001/promptroot-b02a2/us-central1`
  : 'https://us-central1-promptroot-b02a2.cloudfunctions.net';

async function callFunction(name, payload) {
  const user = getAuth()?.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  const res = await fetch(`${BASE_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Send prompt text to OpenClaw via the gateway Cloud Function.
 * @param {string} promptText
 * @param {string} [slug] - Optional prompt slug for logging
 * @returns {Promise<string>} jobId
 */
export async function sendToBrace(promptText, slug = null) {
  const data = await callFunction('callOpenclawGateway', { text: promptText, slug });
  if (!data.jobId) throw new Error('No jobId returned from gateway');
  return data.jobId;
}

/**
 * Poll for a job result.
 * @param {string} jobId
 * @returns {Promise<{ status: 'pending'|'complete'|'error', output?: string }>}
 */
export async function pollBraceJob(jobId) {
  return callFunction('pollOpenclawJob', { jobId });
}
