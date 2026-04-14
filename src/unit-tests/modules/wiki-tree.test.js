import { describe, it, expect, beforeEach } from 'vitest';
import { groupDocsByStatus, renderTree, setActiveTreeItem } from '../../modules/wiki-tree.js';

describe('wiki-tree', () => {
  describe('groupDocsByStatus', () => {
    it('orders statuses with in-progress first', () => {
      const docs = [
        { slug: 'a', status: 'shipped', date: '2026-01-01' },
        { slug: 'b', status: 'in-progress', date: '2026-02-01' },
        { slug: 'c', status: 'approved', date: '2026-03-01' }
      ];
      const groups = groupDocsByStatus(docs);
      const keys = Array.from(groups.keys());
      expect(keys.slice(0, 3)).toEqual(['in-progress', 'approved', 'proposal']);
    });

    it('sorts docs within a group by date descending', () => {
      const docs = [
        { slug: 'old', status: 'shipped', date: '2025-01-01' },
        { slug: 'new', status: 'shipped', date: '2026-04-01' },
        { slug: 'mid', status: 'shipped', date: '2025-12-01' }
      ];
      const groups = groupDocsByStatus(docs);
      expect(groups.get('shipped').map(d => d.slug)).toEqual(['new', 'mid', 'old']);
    });

    it('accepts unknown statuses by adding them', () => {
      const docs = [{ slug: 'x', status: 'weird', date: '2026-01-01' }];
      const groups = groupDocsByStatus(docs);
      expect(groups.get('weird')).toHaveLength(1);
    });
  });

  describe('renderTree', () => {
    let container;
    beforeEach(() => {
      container = document.createElement('div');
    });

    it('renders empty-state when no docs', () => {
      renderTree({ container, docs: [] });
      expect(container.querySelector('.wiki-tree-empty')).toBeTruthy();
    });

    it('renders one group section per non-empty status', () => {
      renderTree({
        container,
        docs: [
          { slug: 'a', title: 'A', status: 'shipped', date: '2026-01-01' },
          { slug: 'b', title: 'B', status: 'in-progress', date: '2026-02-01' }
        ]
      });
      expect(container.querySelectorAll('.wiki-tree-group')).toHaveLength(2);
      expect(container.querySelectorAll('.wiki-tree-link')).toHaveLength(2);
    });

    it('marks the active slug with is-active class', () => {
      renderTree({
        container,
        docs: [{ slug: 'a', title: 'A', status: 'shipped' }],
        activeSlug: 'a'
      });
      const btn = container.querySelector('.wiki-tree-link');
      expect(btn.classList.contains('is-active')).toBe(true);
      expect(btn.getAttribute('aria-current')).toBe('true');
    });

    it('prepends a lock icon for private docs', () => {
      renderTree({
        container,
        docs: [{ slug: 'a', title: 'A', status: 'shipped', private: true }]
      });
      expect(container.querySelector('.wiki-tree-lock')).toBeTruthy();
    });

    it('invokes onSelect with slug on click', () => {
      let picked = null;
      renderTree({
        container,
        docs: [{ slug: 'a', title: 'A', status: 'shipped' }],
        onSelect: s => { picked = s; }
      });
      container.querySelector('.wiki-tree-link').click();
      expect(picked).toBe('a');
    });

    it('does nothing when container is null', () => {
      expect(() => renderTree({ container: null, docs: [] })).not.toThrow();
    });
  });

  describe('setActiveTreeItem', () => {
    it('toggles is-active to match the given slug', () => {
      const container = document.createElement('div');
      renderTree({
        container,
        docs: [
          { slug: 'a', title: 'A', status: 'shipped' },
          { slug: 'b', title: 'B', status: 'shipped' }
        ],
        activeSlug: 'a'
      });
      setActiveTreeItem(container, 'b');
      const links = container.querySelectorAll('.wiki-tree-link');
      const byslug = Object.fromEntries(
        Array.from(links).map(l => [l.dataset.slug, l])
      );
      expect(byslug.a.classList.contains('is-active')).toBe(false);
      expect(byslug.b.classList.contains('is-active')).toBe(true);
      expect(byslug.b.getAttribute('aria-current')).toBe('true');
    });
  });
});
