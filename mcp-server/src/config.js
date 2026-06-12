import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const PROD_BASE = 'https://us-central1-promptroot-b02a2.cloudfunctions.net';

export function apiBase() {
  return process.env.PROMPTROOT_API_BASE || PROD_BASE;
}

export function deviceFlowVerificationUrl() {
  return process.env.PROMPTROOT_DEVICE_FLOW_URL || 'https://promptroot.ai/auth/device';
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
