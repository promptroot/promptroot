import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cloudFunctionUrl } from '../../utils/cloud-function-url.js';

describe('cloudFunctionUrl', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
  });

  function setLocation(host, port) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: host, port: String(port) }
    });
  }

  it('returns the production URL outside emulator port', () => {
    setLocation('promptroot.ai', '443');
    expect(cloudFunctionUrl('createSdd'))
      .toBe('https://us-central1-promptroot-b02a2.cloudfunctions.net/createSdd');
  });

  it('returns localhost emulator URL when port is 5000', () => {
    setLocation('localhost', '5000');
    expect(cloudFunctionUrl('ragQuery'))
      .toBe('http://localhost:5001/promptroot-b02a2/us-central1/ragQuery');
  });

  it('returns production URL when port is 3000 (production npm start)', () => {
    setLocation('localhost', '3000');
    expect(cloudFunctionUrl('listTenants'))
      .toBe('https://us-central1-promptroot-b02a2.cloudfunctions.net/listTenants');
  });
});
