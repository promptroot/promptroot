import { describe, it, expect, vi } from 'vitest';
import { formatEnrichmentSection, enrichPrompt } from '../../modules/wiki-enrichment.js';

describe('wiki-enrichment', () => {
  describe('formatEnrichmentSection', () => {
    it('returns empty string for empty results', () => {
      expect(formatEnrichmentSection([])).toBe('');
      expect(formatEnrichmentSection(null)).toBe('');
    });

    it('formats each result with heading link and text', () => {
      const out = formatEnrichmentSection([
        { heading: 'Auth', url: 'https://x/wiki#auth', text: 'Body A', slug: 'auth' },
        { heading: 'RAG', url: 'https://x/wiki#rag', text: 'Body B', slug: 'rag' }
      ]);
      expect(out).toContain('## Relevant Prior Design Decisions');
      expect(out).toContain('[Auth](https://x/wiki#auth)');
      expect(out).toContain('[RAG](https://x/wiki#rag)');
      expect(out).toContain('Body A');
      expect(out).toContain('Body B');
      expect(out).toContain('(end of prior design context)');
    });

    it('falls back to slug when heading is missing', () => {
      const out = formatEnrichmentSection([
        { slug: 'auth', url: 'u', text: 'b' }
      ]);
      expect(out).toContain('[auth](u)');
    });
  });

  describe('enrichPrompt', () => {
    function mockFetchResults(results) {
      return vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ results })
      });
    }

    it('skips enrichment when disabled', async () => {
      const out = await enrichPrompt('orig', { enabled: false });
      expect(out).toBe('orig');
    });

    it('prepends the enrichment section to the prompt', async () => {
      const fetchImpl = mockFetchResults([
        { heading: 'H', url: 'u', text: 'CTX' }
      ]);
      const out = await enrichPrompt('do the thing', { fetchImpl });
      expect(out).toContain('## Relevant Prior Design Decisions');
      expect(out).toContain('CTX');
      expect(out.endsWith('do the thing')).toBe(true);
    });

    it('returns original prompt when no results', async () => {
      const fetchImpl = mockFetchResults([]);
      expect(await enrichPrompt('x', { fetchImpl })).toBe('x');
    });

    it('returns original prompt and fires onError when ragQuery fails', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const onError = vi.fn();
      expect(await enrichPrompt('x', { fetchImpl, onError })).toBe('x');
      expect(onError).toHaveBeenCalled();
    });
  });
});
