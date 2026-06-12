import { describe, it, expect, beforeEach } from 'vitest';
import { groupDocsByMonth, formatMonth, renderTimeline } from '../../modules/wiki-timeline.js';

describe('wiki-timeline', () => {
  describe('groupDocsByMonth', () => {
    it('groups docs by YYYY-MM and sorts newest first', () => {
      const docs = [
        { slug: 'a', date: '2026-01-15' },
        { slug: 'b', date: '2026-04-01' },
        { slug: 'c', date: '2026-04-12' }
      ];
      const groups = groupDocsByMonth(docs);
      expect(groups[0].month).toBe('2026-04');
      expect(groups[0].docs.map(d => d.slug).sort()).toEqual(['b', 'c']);
      expect(groups[1].month).toBe('2026-01');
    });

    it('handles missing dates by bucketing into 0000-00', () => {
      const groups = groupDocsByMonth([{ slug: 'x' }]);
      expect(groups[0].month).toBe('0000-00');
    });
  });

  describe('formatMonth', () => {
    it('formats YYYY-MM into "Mon YYYY"', () => {
      expect(formatMonth('2026-04')).toBe('Apr 2026');
      expect(formatMonth('2025-12')).toBe('Dec 2025');
    });

    it('returns input unchanged on malformed value', () => {
      expect(formatMonth('nope')).toBe('nope');
      expect(formatMonth('2026-13')).toBe('2026-13');
    });
  });

  describe('renderTimeline', () => {
    let container;
    beforeEach(() => {
      container = document.createElement('div');
    });

    it('renders empty state when no docs', () => {
      renderTimeline({ container, docs: [] });
      expect(container.querySelector('.wiki-tree-empty')).toBeTruthy();
    });

    it('renders one section per month in order', () => {
      renderTimeline({
        container,
        docs: [
          { slug: 'a', title: 'A', date: '2026-01-15', status: 'shipped' },
          { slug: 'b', title: 'B', date: '2026-04-01', status: 'shipped' }
        ]
      });
      const labels = Array.from(container.querySelectorAll('.wiki-timeline-month-label'))
        .map(el => el.textContent);
      expect(labels).toEqual(['Apr 2026', 'Jan 2026']);
    });

    it('fires onSelect with the clicked slug', () => {
      let picked = null;
      renderTimeline({
        container,
        docs: [{ slug: 'a', title: 'A', date: '2026-01-15', status: 'shipped' }],
        onSelect: s => { picked = s; }
      });
      container.querySelector('.wiki-timeline-link').click();
      expect(picked).toBe('a');
    });
  });
});
