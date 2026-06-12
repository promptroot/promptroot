import { describe, it, expect, vi } from 'vitest';
import { ragQuery } from '../../utils/rag-client.js';

describe('rag-client', () => {
  it('throws on empty query', async () => {
    await expect(ragQuery({ query: '' })).rejects.toThrow(/query is required/);
  });

  it('POSTs the query with JSON body and returns results array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ slug: 'a', score: 1 }] })
    });
    const out = await ragQuery({
      query: 'auth flow',
      topK: 3,
      endpoint: 'https://x.test/rag',
      fetchImpl
    });
    expect(out).toEqual([{ slug: 'a', score: 1 }]);
    const call = fetchImpl.mock.calls[0];
    expect(call[0]).toBe('https://x.test/rag');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(call[1].body)).toEqual({ query: 'auth flow', topK: 3 });
  });

  it('throws on non-OK response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(ragQuery({ query: 'x', fetchImpl })).rejects.toThrow(/500/);
  });

  it('returns empty array when results missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({})
    });
    expect(await ragQuery({ query: 'x', fetchImpl })).toEqual([]);
  });
});
