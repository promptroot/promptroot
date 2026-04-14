import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../modules/prompt-renderer.js', () => ({
  sanitizeHtml: vi.fn(html => html.replace(/<script[\s\S]*?<\/script>/gi, ''))
}));

vi.mock('../../utils/lazy-loaders.js', () => ({
  loadMarked: vi.fn(async () => ({
    parse: md => `<p>${md.replace(/\n/g, ' ').trim()}</p>`
  }))
}));

import {
  configureWikiRenderer,
  fetchDocMarkdown,
  stripFrontmatter,
  renderDoc,
  paintDoc,
  buildAgentContextMarkdown
} from '../../modules/wiki-renderer.js';

describe('wiki-renderer', () => {
  describe('stripFrontmatter', () => {
    it('strips a leading YAML frontmatter block', () => {
      const md = '---\ntitle: X\nslug: x\n---\n# Heading\nBody.';
      expect(stripFrontmatter(md)).toBe('# Heading\nBody.');
    });

    it('returns input unchanged when no frontmatter', () => {
      expect(stripFrontmatter('# Heading\nBody.')).toBe('# Heading\nBody.');
    });

    it('returns input unchanged when closing delimiter is missing', () => {
      const md = '---\ntitle: X\n';
      expect(stripFrontmatter(md)).toBe(md);
    });
  });

  describe('fetchDocMarkdown', () => {
    it('fetches raw text from prefixed docPath', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true, status: 200, text: async () => '# raw'
      });
      const out = await fetchDocMarkdown('docs/sdd/a.md', { fetchImpl });
      expect(out).toBe('# raw');
      expect(fetchImpl).toHaveBeenCalledWith('/docs/sdd/a.md', { cache: 'no-cache' });
    });

    it('throws on non-OK response', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      await expect(fetchDocMarkdown('docs/sdd/missing.md', { fetchImpl }))
        .rejects.toThrow(/404/);
    });
  });

  describe('renderDoc', () => {
    beforeEach(() => {
      configureWikiRenderer({ canSeePrivate: () => false });
    });

    it('blocks private docs when caller cannot see them', async () => {
      const out = await renderDoc({
        slug: 'p', visibility: 'private', docPath: 'docs/sdd/p.md'
      });
      expect(out).toEqual({ html: null, blocked: true });
    });

    it('renders public docs through marked + sanitizer', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        text: async () => '---\nslug: a\n---\n\n# Hi'
      });
      const out = await renderDoc({
        slug: 'a', visibility: 'public', docPath: 'docs/sdd/a.md'
      }, { fetchImpl });
      expect(out.blocked).toBe(false);
      expect(out.html).toContain('Hi');
    });

    it('renders private docs when caller is authorized', async () => {
      configureWikiRenderer({ canSeePrivate: () => true });
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true, status: 200, text: async () => '# secret'
      });
      const out = await renderDoc({
        slug: 'p', visibility: 'private', docPath: 'docs/sdd/p.md'
      }, { fetchImpl });
      expect(out.blocked).toBe(false);
    });

    it('throws when doc is null', async () => {
      await expect(renderDoc(null)).rejects.toThrow();
    });
  });

  describe('paintDoc', () => {
    function mkElements() {
      const mk = () => document.createElement('div');
      const titleEl = document.createElement('h1');
      const dateEl = mk();
      const statusEl = mk();
      const ownerEl = mk();
      const tagsEl = mk();
      const bodyEl = mk();
      const placeholder = mk();
      const header = mk();
      const related = mk();
      const relatedList = document.createElement('ul');
      return {
        placeholder, header, titleEl, dateEl, statusEl, ownerEl, tagsEl,
        bodyEl, related, relatedList
      };
    }

    it('paints title, status, owner, tags, and body HTML', () => {
      const elements = mkElements();
      paintDoc({
        doc: {
          slug: 'a', title: 'Title', date: '2026-04-13',
          status: 'shipped', owner: 'jesse', tags: ['x', 'y']
        },
        html: '<p>hello</p>',
        blocked: false,
        elements
      });
      expect(elements.titleEl.textContent).toBe('Title');
      expect(elements.statusEl.dataset.status).toBe('shipped');
      expect(elements.ownerEl.textContent).toBe('@jesse');
      expect(elements.tagsEl.querySelectorAll('.wiki-tag')).toHaveLength(2);
      expect(elements.bodyEl.innerHTML).toBe('<p>hello</p>');
    });

    it('renders a private-notice when blocked', () => {
      const elements = mkElements();
      paintDoc({
        doc: { slug: 'p', title: 'Private', tags: [] },
        html: null,
        blocked: true,
        elements
      });
      expect(elements.bodyEl.querySelector('.wiki-private-notice')).toBeTruthy();
    });

    it('shows related list when related docs are provided', () => {
      const elements = mkElements();
      paintDoc({
        doc: { slug: 'a', tags: [] },
        html: '<p/>',
        blocked: false,
        elements,
        relatedDocs: [{ slug: 'b', title: 'B' }]
      });
      expect(elements.related.hidden).toBe(false);
      const link = elements.relatedList.querySelector('a');
      expect(link.getAttribute('href')).toBe('#b');
      expect(link.dataset.slug).toBe('b');
    });

    it('hides related list when none', () => {
      const elements = mkElements();
      paintDoc({
        doc: { slug: 'a', tags: [] },
        html: '<p/>',
        blocked: false,
        elements,
        relatedDocs: []
      });
      expect(elements.related.hidden).toBe(true);
    });
  });

  describe('buildAgentContextMarkdown', () => {
    it('includes title, source URL, status line, and body', () => {
      const md = buildAgentContextMarkdown(
        { slug: 'a', title: 'A', status: 'shipped', date: '2026-04-13', owner: 'jesse', tags: ['x'] },
        '## Section\nBody',
        []
      );
      expect(md).toContain('# A');
      expect(md).toContain('https://promptroot.ai/wiki#a');
      expect(md).toContain('Status: shipped');
      expect(md).toContain('Tags: x');
      expect(md).toContain('Body');
    });

    it('appends Related SDDs section when related docs exist', () => {
      const md = buildAgentContextMarkdown(
        { slug: 'a', title: 'A', status: 'shipped', date: '2026-04-13', owner: 'j' },
        'body',
        [{ slug: 'b', title: 'B', status: 'proposal' }]
      );
      expect(md).toContain('## Related SDDs');
      expect(md).toContain('[B](https://promptroot.ai/wiki#b)');
    });

    it('omits Related SDDs section when no related docs', () => {
      const md = buildAgentContextMarkdown(
        { slug: 'a', title: 'A', status: 'shipped', date: '2026-04-13', owner: 'j' },
        'body',
        []
      );
      expect(md).not.toContain('Related SDDs');
    });
  });
});
