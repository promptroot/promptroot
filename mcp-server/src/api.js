import { apiBase } from './config.js';
import { readCredentials } from './credentials.js';

export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function getSessionToken() {
  if (process.env.PROMPTROOT_SESSION_TOKEN) return process.env.PROMPTROOT_SESSION_TOKEN;
  const creds = await readCredentials();
  if (!creds || !creds.sessionToken) {
    throw new ApiError(
      'Not authenticated. Run "promptroot-mcp-login" to set up credentials.',
      401
    );
  }
  return creds.sessionToken;
}

export async function callFunction(name, payload, { authenticated = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const token = await getSessionToken();
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `${apiBase()}/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {})
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    throw new ApiError(data.error || `HTTP ${response.status}`, response.status);
  }
  return data;
}
