import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, stripMarkdown, STOPWORDS } from '../../utils/tokenizer.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('tokenizer', () => {
  describe('stripMarkdown', () => {
    it('strips fenced code blocks', () => {
      const md = 'Before\n```js\nconst x = 1;\n```\nAfter';
      const out = stripMarkdown(md);
      expect(out).not.toContain('const');
      expect(out).toContain('Before');
      expect(out).toContain('After');
    });

    it('strips inline code', () => {
      expect(stripMarkdown('use `fetch()` today').toLowerCase()).not.toContain('fetch');
    });

    it('keeps link text and drops URLs', () => {
      const out = stripMarkdown('see [the docs](https://example.com/docs)');
      expect(out).toContain('docs');
      expect(out).not.toContain('example.com');
    });

    it('strips heading markers', () => {
      expect(stripMarkdown('## Heading')).toBe('Heading');
    });
  });

  describe('tokenize', () => {
    it('lowercases and splits on non-word boundaries', () => {
      expect(tokenize('Auth Flow and Firebase')).toEqual(['auth', 'flow', 'firebase']);
    });

    it('drops stopwords', () => {
      const out = tokenize('the quick and brown fox');
      expect(out).not.toContain('the');
      expect(out).not.toContain('and');
      expect(out).toContain('quick');
    });

    it('drops single-character tokens', () => {
      expect(tokenize('a big X test')).not.toContain('a');
      expect(tokenize('a big X test')).not.toContain('x');
    });

    it('returns empty array for empty input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize(null)).toEqual([]);
    });

    it('tokenizes a realistic SDD snippet', () => {
      const md = '## Retrieval algorithm\n\nWe chose BM25 over `cosine` embeddings.';
      const out = tokenize(md);
      expect(out).toContain('retrieval');
      expect(out).toContain('algorithm');
      expect(out).toContain('bm25');
      expect(out).not.toContain('cosine');
    });
  });

  describe('STOPWORDS', () => {
    it('is a Set', () => {
      expect(STOPWORDS).toBeInstanceOf(Set);
      expect(STOPWORDS.has('the')).toBe(true);
    });
  });

  describe('ESM/CJS parity', () => {
    it('scripts/lib/tokenizer.cjs produces identical output for shared fixtures', async () => {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const cjsPath = resolve(here, '../../../scripts/lib/tokenizer.cjs');
      const cjs = require(cjsPath);
      const fixtures = [
        'BM25 retrieval over Firestore chunks',
        '## Auth Flow\n\nWe gate private docs on `request.auth`.',
        '',
        'code: ```js\nconst x = 1;\n``` after',
        '[link text](https://example.com/path)'
      ];
      for (const f of fixtures) {
        expect(cjs.tokenize(f)).toEqual(tokenize(f));
      }
    });
  });
});
