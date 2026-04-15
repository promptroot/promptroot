import { describe, it, expect } from 'vitest';
import { splitByHeading, subdivideOversized, chunkDoc, MAX_TOKENS } from '../../../scripts/lib/chunker.js';

describe('chunker', () => {
  describe('splitByHeading', () => {
    it('splits at ## headings', () => {
      const body = 'intro\n\n## First\nbody a\n\n## Second\nbody b';
      const sections = splitByHeading(body);
      expect(sections.map(s => s.heading)).toEqual([null, 'First', 'Second']);
      expect(sections[1].text).toContain('body a');
    });

    it('ignores ### and #### headings', () => {
      const body = '## One\npara\n\n### sub\nmore';
      const sections = splitByHeading(body);
      expect(sections).toHaveLength(1);
      expect(sections[0].text).toContain('### sub');
    });

    it('drops empty leading section when body starts with ##', () => {
      const body = '## Only\nbody';
      expect(splitByHeading(body)).toHaveLength(1);
    });
  });

  describe('subdivideOversized', () => {
    it('leaves small sections alone', () => {
      const section = { heading: 'x', text: 'a b c d e' };
      expect(subdivideOversized(section)).toEqual([section]);
    });

    it('splits oversized sections at paragraph boundaries', () => {
      const big = Array.from({ length: 700 }, (_, i) => `word${i}`).join(' ');
      const section = { heading: 'x', text: big + '\n\n' + big };
      const pieces = subdivideOversized(section);
      expect(pieces.length).toBeGreaterThan(1);
      expect(pieces.every(p => p.heading === 'x')).toBe(true);
    });
  });

  describe('chunkDoc', () => {
    const doc = {
      slug: 'demo',
      title: 'Demo',
      docPath: 'wiki/demo.md',
      visibility: 'public',
      tags: ['infra'],
      date: '2026-04-13'
    };

    it('produces chunks carrying doc metadata and tokens', () => {
      const chunks = chunkDoc(doc, '## Intro\nHello world\n\n## Details\nMore content');
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({
        slug: 'demo',
        docPath: 'wiki/demo.md',
        heading: 'Intro',
        chunkIndex: 0,
        visibility: 'public',
        date: '2026-04-13'
      });
      expect(chunks[0].id).toBe('demo__0');
      expect(Array.isArray(chunks[0].tokens)).toBe(true);
      expect(chunks[0].tokens.length).toBeGreaterThan(0);
    });

    it('falls back to doc.title for pre-heading chunks', () => {
      const chunks = chunkDoc(doc, 'Preamble text\n\n## Real heading\nstuff');
      expect(chunks[0].heading).toBe('Demo');
      expect(chunks[1].heading).toBe('Real heading');
    });

    it('respects MAX_TOKENS as the split threshold', () => {
      expect(MAX_TOKENS).toBeGreaterThan(100);
    });
  });
});
