import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, callFunction } from '../src/api.js';

// Simple mock for fetch
let mockFetchFn = null;
global.fetch = async (...args) => {
  if (mockFetchFn) return mockFetchFn(...args);
  throw new Error('fetch not mocked');
};

test('ApiError', async (t) => {
  await t.test('creates error with message and statusCode', () => {
    const err = new ApiError('Unauthorized', 401);
    assert.strictEqual(err.message, 'Unauthorized');
    assert.strictEqual(err.statusCode, 401);
    assert(err instanceof Error);
  });
});

test('callFunction', async (t) => {
  t.beforeEach(() => {
    delete process.env.PROMPTROOT_SESSION_TOKEN;
    delete process.env.PROMPTROOT_API_BASE;
  });

  await t.test('calls authenticated endpoint with bearer token from env', async () => {
    process.env.PROMPTROOT_SESSION_TOKEN = 'prs_test123';
    process.env.PROMPTROOT_API_BASE = 'http://test-api';

    let capturedRequest;
    mockFetchFn = (url, options) => {
      capturedRequest = { url, options };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ result: 'ok' })
      });
    };

    const result = await callFunction('testFunc', { foo: 'bar' });

    assert.strictEqual(capturedRequest.url, 'http://test-api/testFunc');
    assert.strictEqual(capturedRequest.options.method, 'POST');
    assert.strictEqual(capturedRequest.options.headers.Authorization, 'Bearer prs_test123');
    assert.deepStrictEqual(result, { result: 'ok' });
  });

  await t.test('allows unauthenticated calls', async () => {
    process.env.PROMPTROOT_API_BASE = 'http://test-api';

    mockFetchFn = (url, options) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      });
    };

    const result = await callFunction('startDeviceAuth', { deviceLabel: 'test' }, { authenticated: false });
    assert.deepStrictEqual(result, { ok: true });
  });

  await t.test('throws ApiError with custom message on failure', async () => {
    process.env.PROMPTROOT_SESSION_TOKEN = 'prs_token';
    process.env.PROMPTROOT_API_BASE = 'http://test-api';

    mockFetchFn = () => {
      return Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Tenant not accessible' })
      });
    };

    try {
      await callFunction('getSdd', { tenantId: 'x', slug: 'y' });
      assert.fail('should have thrown');
    } catch (err) {
      assert(err instanceof ApiError);
      assert.strictEqual(err.message, 'Tenant not accessible');
      assert.strictEqual(err.statusCode, 403);
    }
  });

  await t.test('falls back to HTTP status on missing error field', async () => {
    process.env.PROMPTROOT_SESSION_TOKEN = 'prs_token';
    process.env.PROMPTROOT_API_BASE = 'http://test-api';

    mockFetchFn = () => {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({})
      });
    };

    try {
      await callFunction('test', {});
      assert.fail('should have thrown');
    } catch (err) {
      assert(err instanceof ApiError);
      assert.strictEqual(err.message, 'HTTP 500');
      assert.strictEqual(err.statusCode, 500);
    }
  });

  await t.test('throws when not authenticated and no session token', async () => {
    process.env.PROMPTROOT_API_BASE = 'http://test-api';

    try {
      await callFunction('getSdd', { tenantId: 'x' });
      assert.fail('should have thrown');
    } catch (err) {
      assert(err instanceof ApiError);
      assert(err.message.includes('Not authenticated'));
      assert.strictEqual(err.statusCode, 401);
    }
  });
});
