import { hostname } from 'node:os';
import { callFunction } from './api.js';
import { writeCredentials } from './credentials.js';
import { deviceFlowVerificationUrl } from './config.js';

const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function loginViaDeviceFlow({ deviceLabel } = {}) {
  const label = deviceLabel || `${hostname()} CLI`;
  const start = await callFunction('startDeviceAuth', { deviceLabel: label }, { authenticated: false });

  const override = process.env.PROMPTROOT_DEVICE_FLOW_URL;
  const url = override || start.verificationUrl || deviceFlowVerificationUrl();
  process.stderr.write(`\nVisit: ${url}\nEnter code: ${start.userCode}\n\n`);

  const intervalSec = Math.max(1, start.pollIntervalSeconds || 5);
  const begun = Date.now();
  while (Date.now() - begun < POLL_TIMEOUT_MS) {
    await delay(intervalSec * 1000);
    let result;
    try {
      result = await callFunction('pollDeviceAuth', { deviceCode: start.deviceCode }, { authenticated: false });
    } catch (err) {
      if (err.statusCode === 410) throw new Error('Device code already consumed');
      throw err;
    }
    if (result.status === 'authorized' && result.sessionToken) {
      await writeCredentials({
        sessionToken: result.sessionToken,
        sessionId: result.sessionId,
        uid: result.uid,
        deviceLabel: label,
        savedAt: new Date().toISOString()
      });
      return { uid: result.uid, sessionId: result.sessionId };
    }
    if (result.status === 'expired') throw new Error('Device code expired');
  }
  throw new Error('Device authorization timed out');
}
