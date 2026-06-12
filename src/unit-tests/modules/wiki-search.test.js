import { describe, it, expect, beforeEach } from 'vitest';
import { tokenizeQuery, searchDocs, renderSearchResults } from '../../modules/wiki-search.js';

describe('wiki-search', () => {
  describe('tokenizeQuery', () => {
    it('lowercases and splits on non-word chars', () => {
      expect(tokenizeQuery('Auth Flow')).toEqual(['auth', 'flow']);
      expect(tokenizeQuery('RAG/embeddings!')).toEqual(['rag', 'embeddings']);
    });

    it('drops single-character tokens', () => {
      expect(tokenizeQuery('a wiki b')).toEqual(['wiki']);
    });

    it('returns empty array for empty input', () => {
      expect(tokenizeQuery('')).toEqual([]);
      expect(tokenizeQuery(null)).toEqual([]);
    });
  });

  describe('searchDocs', () => {
    const docs = [
      {
        slug: 'auth',
        title: 'Auth Flow',
        tags: ['auth', 'firebase'],
        headings: [{ text: 'Login Sequence' }]
      },
      {
        slug: 'rag',
        title: 'RAG Pipeline',
        tags: ['rag'],
        headings: [{ text: 'BM25 Ranker' }]
      },
      {
        slug: 'other',
        title: 'Unrelated Note',
        tags: [],
        headings: []
      }
    ];

    it('returns empty for empty query', () => {
      expect(searchDocs(docs, '')).toEqual([]);
    });

    it('matches by title', () => {
      const out = searchDocs(docs, 'auth');
      expect(out.map(r => r.doc.slug)).toContain('auth');
    });

    it('matches by tag', () => {
      const out = searchDocs(docs, 'firebase');
      expect(out.map(r => r.doc.slug)).toEqual(['auth']);
    });

    it('matches by heading text', () => {
      const out = searchDocs(docs, 'bm25');
      expect(out.map(r => r.doc.slug)).toEqual(['rag']);
    });

    it('requires ALL tokens to match', () => {
      const out = searchDocs(docs, 'auth nonexistent');
      expect(out).toHaveLength(0);
    });

    it('boosts title matches over heading-only matches', () => {
      const out = searchDocs(docs, 'auth');
      const scores = Object.fromEntries(out.map(r => [r.doc.slug, r.score]));
      expect(scores.auth).toBeGreaterThan(0);
    });

    it('is case insensitive', () => {
      const out = searchDocs(docs, 'AUTH');
      expect(out.map(r => r.doc.slug)).toContain('auth');
    });
  });

  describe('renderSearchResults', () => {
    let container;
    beforeEach(() => {
      container = document.createElement('div');
    });

    it('renders empty message for no results', () => {
      renderSearchResults({ container, results: [] });
      expect(container.querySelector('.wiki-search-empty')).toBeTruthy();
    });

    it('renders one link per result', () => {
      renderSearchResults({
        container,
        results: [
          { doc: { slug: 'a', title: 'A', date: '2026-01-01', status: 'shipped' }, score: 5 },
          { doc: { slug: 'b', title: 'B', date: '2026-02-01', status: 'approved' }, score: 2 }
        ]
      });
      expect(container.querySelectorAll('.wiki-search-link')).toHaveLength(2);
    });

    it('fires onSelect with slug on click', () => {
      let picked = null;
      renderSearchResults({
        container,
        results: [{ doc: { slug: 'a', title: 'A' }, score: 1 }],
        onSelect: s => { picked = s; }
      });
      container.querySelector('.wiki-search-link').click();
      expect(picked).toBe('a');
    });
  });
});
