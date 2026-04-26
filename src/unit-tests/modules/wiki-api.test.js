import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: () => ({
    currentUser: {
      getIdToken: async () => 'fake-id-token-xyz'
    }
  })
}));

import {
  createTenant,
  listTenants,
  createSdd,
  updateSdd,
  listSdds,
  getSdd,
  listVersions,
  restoreVersion,
  authorizeDevice,
  listSessions,
  revokeSession
} from '../../modules/wiki-api.js';

describe('wiki-api client', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'promptroot.ai', port: '443' }
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockOk(payload) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload
    });
  }

  function mockFail(status, body) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => body
    });
  }

  it('createTenant POSTs JSON to the right URL with bearer auth', async () => {
    mockOk({ tenantId: 'planet', slug: 'planet' });
    await createTenant({ slug: 'planet', name: 'Planet', visibility: 'private' });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://us-central1-promptroot-b02a2.cloudfunctions.net/createTenant');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-id-token-xyz');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ slug: 'planet', name: 'Planet', visibility: 'private' });
  });

  it('listTenants returns parsed JSON', async () => {
    mockOk({ tenants: [{ slug: 'planet', name: 'Planet' }] });
    const r = await listTenants();
    expect(r.tenants[0].slug).toBe('planet');
  });

  it.each([
    ['createSdd', createSdd, { tenantId: 'planet', slug: 'a', frontmatter: {}, body: 'hi' }],
    ['updateSdd', updateSdd, { tenantId: 'planet', slug: 'a', body: 'new' }],
    ['getSdd', getSdd, { tenantId: 'planet', slug: 'a' }],
    ['listVersions', listVersions, { tenantId: 'planet', slug: 'a' }],
    ['restoreVersion', restoreVersion, { tenantId: 'planet', slug: 'a', versionId: 'v1' }]
  ])('%s posts to its own endpoint', async (name, fn, payload) => {
    mockOk({ ok: true });
    await fn(payload);
    expect(global.fetch.mock.calls[0][0]).toContain(`/${name}`);
  });

  it('listSdds wraps tenantId payload', async () => {
    mockOk({ sdds: [] });
    await listSdds('planet');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ tenantId: 'planet' });
  });

  it('authorizeDevice / listSessions / revokeSession route correctly', async () => {
    mockOk({});
    await authorizeDevice('WDJB-MJHT');
    expect(global.fetch.mock.calls[0][0]).toContain('/authorizeDevice');

    mockOk({ sessions: [] });
    await listSessions();
    expect(global.fetch.mock.calls[0][0]).toContain('/listSessions');

    mockOk({});
    await revokeSession({ sessionId: 'abc' });
    expect(global.fetch.mock.calls[0][0]).toContain('/revokeSession');
  });

  it('throws an Error with the server-provided message on non-2xx', async () => {
    mockFail(403, { error: 'Tenant not accessible' });
    await expect(getSdd({ tenantId: 'x', slug: 'y' })).rejects.toThrow('Tenant not accessible');
  });

  it('falls back to HTTP status when no error message is provided', async () => {
    mockFail(500, {});
    await expect(getSdd({ tenantId: 'x', slug: 'y' })).rejects.toThrow(/HTTP 500/);
  });
});
