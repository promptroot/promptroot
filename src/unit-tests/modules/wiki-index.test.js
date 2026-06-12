import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWikiIndex,
  resetWikiIndexCache,
  filterDocsByVisibility,
  findDocBySlug,
  getRelatedDocs
} from '../../modules/wiki-index.js';

function mockFetchOk(body) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body
  });
}

function mockFetchFail(status = 404) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({})
  });
}

describe('wiki-index', () => {
  beforeEach(() => {
    resetWikiIndexCache();
  });

  describe('loadWikiIndex', () => {
    it('loads and returns index json', async () => {
      const fetchImpl = mockFetchOk({ version: 1, docs: [{ slug: 'a' }] });
      const data = await loadWikiIndex({ fetchImpl, url: '/x.json' });
      expect(data.docs).toHaveLength(1);
      expect(fetchImpl).toHaveBeenCalledWith('/x.json', { cache: 'no-cache' });
    });

    it('caches across calls', async () => {
      const fetchImpl = mockFetchOk({ docs: [] });
      await loadWikiIndex({ fetchImpl, url: '/x.json' });
      await loadWikiIndex({ fetchImpl, url: '/x.json' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('throws on non-OK response', async () => {
      const fetchImpl = mockFetchFail(500);
      await expect(loadWikiIndex({ fetchImpl, url: '/x.json' }))
        .rejects.toThrow(/500/);
    });

    it('throws when docs array is missing', async () => {
      const fetchImpl = mockFetchOk({ version: 1 });
      await expect(loadWikiIndex({ fetchImpl, url: '/x.json' }))
        .rejects.toThrow(/malformed/);
    });

    it('deduplicates inflight requests', async () => {
      const fetchImpl = vi.fn(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true, status: 200, json: async () => ({ docs: [] })
        }), 5);
      }));
      const [a, b] = await Promise.all([
        loadWikiIndex({ fetchImpl, url: '/x.json' }),
        loadWikiIndex({ fetchImpl, url: '/x.json' })
      ]);
      expect(a).toBe(b);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('filterDocsByVisibility', () => {
    const docs = [
      { slug: 'a', visibility: 'public' },
      { slug: 'b', visibility: 'private' },
      { slug: 'c', visibility: 'public' }
    ];

    it('excludes private when caller cannot see them', () => {
      const out = filterDocsByVisibility(docs, false);
      expect(out.map(d => d.slug)).toEqual(['a', 'c']);
    });

    it('includes private when caller is authorized', () => {
      expect(filterDocsByVisibility(docs, true)).toHaveLength(3);
    });

    it('returns empty array for non-array input', () => {
      expect(filterDocsByVisibility(null, true)).toEqual([]);
      expect(filterDocsByVisibility(undefined, false)).toEqual([]);
    });
  });

  describe('findDocBySlug', () => {
    const docs = [{ slug: 'a' }, { slug: 'b' }];

    it('returns the doc when slug matches', () => {
      expect(findDocBySlug(docs, 'b')).toEqual({ slug: 'b' });
    });

    it('returns null when slug missing', () => {
      expect(findDocBySlug(docs, 'x')).toBeNull();
    });

    it('returns null on invalid inputs', () => {
      expect(findDocBySlug(null, 'a')).toBeNull();
      expect(findDocBySlug(docs, '')).toBeNull();
    });
  });

  describe('getRelatedDocs', () => {
    const docs = [
      { slug: 'a', related: ['b', 'c'] },
      { slug: 'b' },
      { slug: 'c' }
    ];

    it('resolves related slugs to docs', () => {
      expect(getRelatedDocs(docs, 'a').map(d => d.slug)).toEqual(['b', 'c']);
    });

    it('drops unresolved slugs', () => {
      const d = [{ slug: 'a', related: ['nope', 'b'] }, { slug: 'b' }];
      expect(getRelatedDocs(d, 'a').map(x => x.slug)).toEqual(['b']);
    });

    it('returns empty array when doc has no related', () => {
      expect(getRelatedDocs(docs, 'b')).toEqual([]);
    });

    it('returns empty array when doc is missing', () => {
      expect(getRelatedDocs(docs, 'missing')).toEqual([]);
    });
  });
});
