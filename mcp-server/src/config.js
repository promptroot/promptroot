import { homedir, platform } from 'node:os';
import { join } from 'node:path';

// Default deployment identity. To point the CLI/MCP server at a self-hosted
// instance, change these constants or set the PROMPTROOT_* env vars below.
// See docs/DEPLOYMENT_CONFIG.md.
const DEFAULT_PROJECT_ID = 'promptroot-b02a2';
const DEFAULT_REGION = 'us-central1';
const DEFAULT_WEB_URL = 'https://promptroot.ai';

const PROD_BASE = `https://${DEFAULT_REGION}-${DEFAULT_PROJECT_ID}.cloudfunctions.net`;

export function apiBase() {
  return process.env.PROMPTROOT_API_BASE || PROD_BASE;
}

export function webBase() {
  return process.env.PROMPTROOT_WEB_URL || DEFAULT_WEB_URL;
}

export function deviceFlowVerificationUrl() {
  return process.env.PROMPTROOT_DEVICE_FLOW_URL || `${webBase()}/auth/device`;
}

export function credentialsPath() {
  if (process.env.PROMPTROOT_CREDENTIALS_PATH) {
    return process.env.PROMPTROOT_CREDENTIALS_PATH;
  }
  if (platform() === 'win32') {
    const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appdata, 'promptroot', 'credentials.json');
  }
  return join(homedir(), '.config', 'promptroot', 'credentials.json');
}
