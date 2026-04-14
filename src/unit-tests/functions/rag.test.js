import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { rank, computeStats } = require(resolve(here, '../../../functions/rag.js'));
const { tokenize } = require(resolve(here, '../../../scripts/lib/tokenizer.cjs'));

function chunk(slug, heading, text, opts = {}) {
  return {
    id: `${slug}__${opts.idx || 0}`,
    slug,
    docPath: `docs/sdd/${slug}.md`,
    heading,
    chunkIndex: opts.idx || 0,
    text,
    tokens: tokenize(`${heading} ${text}`),
    visibility: opts.visibility || 'public',
    tags: opts.tags || [],
    date: '2026-04-13'
  };
}

describe('functions/rag', () => {
  describe('rank', () => {
    const chunks = [
      chunk('auth', 'Auth Flow', 'We authenticate via Firebase GitHub provider.'),
      chunk('rag', 'BM25 Ranker', 'The ranker uses BM25 over tokenized chunks.'),
      chunk('wiki', 'Timeline View', 'Docs are grouped by month on the timeline.'),
      chunk('secret', 'Internal', 'private infra details only', { visibility: 'private' })
    ];

    it('returns empty array for empty query', () => {
      expect(rank({ query: '', chunks })).toEqual([]);
    });

    it('ranks BM25 relevance with the expected chunk on top', () => {
      const out = rank({ query: 'BM25 ranker', chunks, topK: 3 });
      expect(out[0].slug).toBe('rag');
    });

    it('excludes private chunks by default', () => {
      const out = rank({ query: 'infra details private', chunks, topK: 5 });
      expect(out.every(r => r.slug !== 'secret')).toBe(true);
    });

    it('includes private chunks when includePrivate is true', () => {
      const out = rank({
        query: 'infra details private',
        chunks,
        topK: 5,
        includePrivate: true
      });
      expect(out.some(r => r.slug === 'secret')).toBe(true);
    });

    it('caps results at topK', () => {
      const out = rank({ query: 'we', chunks, topK: 1 });
      expect(out.length).toBeLessThanOrEqual(1);
    });

    it('populates url field with wiki slug anchor', () => {
      const out = rank({ query: 'BM25', chunks, topK: 1 });
      expect(out[0].url).toBe('https://promptroot.ai/wiki#rag');
    });

    it('boosts heading matches over body-only matches', () => {
      const bodyOnly = chunk('a', 'Misc', 'this mentions firebase in the body only');
      const headingMatch = chunk('b', 'Firebase Setup', 'generic body text');
      const out = rank({ query: 'firebase', chunks: [bodyOnly, headingMatch], topK: 2 });
      expect(out[0].slug).toBe('b');
    });
  });

  describe('computeStats', () => {
    it('returns doc frequencies and average length', () => {
      const chunks = [
        chunk('a', 'x', 'firebase auth', { idx: 0 }),
        chunk('b', 'y', 'firebase firestore', { idx: 1 })
      ];
      const stats = computeStats(chunks);
      expect(stats.N).toBe(2);
      expect(stats.docFreq.get('firebase')).toBe(2);
      expect(stats.avgLen).toBeGreaterThan(0);
    });
  });
});
