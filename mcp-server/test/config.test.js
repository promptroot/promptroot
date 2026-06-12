import { test } from 'node:test';
import assert from 'node:assert';
import { apiBase, deviceFlowVerificationUrl, credentialsPath } from '../src/config.js';

test('config', async (t) => {
  await t.test('apiBase returns production URL by default', () => {
    const orig = process.env.PROMPTROOT_API_BASE;
    delete process.env.PROMPTROOT_API_BASE;
    assert.strictEqual(
      apiBase(),
      'https://us-central1-promptroot-b02a2.cloudfunctions.net'
    );
    if (orig) process.env.PROMPTROOT_API_BASE = orig;
  });

  await t.test('apiBase respects PROMPTROOT_API_BASE env var', () => {
    const orig = process.env.PROMPTROOT_API_BASE;
    process.env.PROMPTROOT_API_BASE = 'http://localhost:5001';
    assert.strictEqual(apiBase(), 'http://localhost:5001');
    if (orig) process.env.PROMPTROOT_API_BASE = orig;
    else delete process.env.PROMPTROOT_API_BASE;
  });

  await t.test('deviceFlowVerificationUrl returns production URL by default', () => {
    const orig = process.env.PROMPTROOT_DEVICE_FLOW_URL;
    delete process.env.PROMPTROOT_DEVICE_FLOW_URL;
    assert.strictEqual(
      deviceFlowVerificationUrl(),
      'https://promptroot.ai/auth/device'
    );
    if (orig) process.env.PROMPTROOT_DEVICE_FLOW_URL = orig;
  });

  await t.test('credentialsPath respects env var', () => {
    const orig = process.env.PROMPTROOT_CREDENTIALS_PATH;
    process.env.PROMPTROOT_CREDENTIALS_PATH = '/tmp/test-creds.json';
    assert.strictEqual(credentialsPath(), '/tmp/test-creds.json');
    if (orig) process.env.PROMPTROOT_CREDENTIALS_PATH = orig;
    else delete process.env.PROMPTROOT_CREDENTIALS_PATH;
  });
});
