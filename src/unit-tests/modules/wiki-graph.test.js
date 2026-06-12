import { describe, it, expect } from 'vitest';
import { buildGraphData } from '../../modules/wiki-graph.js';

describe('wiki-graph', () => {
  describe('buildGraphData', () => {
    it('creates one node per doc with status data', () => {
      const { nodes } = buildGraphData([
        { slug: 'a', title: 'A', status: 'shipped' },
        { slug: 'b', title: 'B', status: 'in-progress' }
      ]);
      expect(nodes).toHaveLength(2);
      expect(nodes[0].data).toMatchObject({ id: 'a', label: 'A', status: 'shipped' });
    });

    it('falls back to slug when title is missing', () => {
      const { nodes } = buildGraphData([{ slug: 'a' }]);
      expect(nodes[0].data.label).toBe('a');
      expect(nodes[0].data.status).toBe('unknown');
    });

    it('creates edges for related slugs that exist', () => {
      const { edges } = buildGraphData([
        { slug: 'a', related: ['b'] },
        { slug: 'b' }
      ]);
      expect(edges).toHaveLength(1);
      expect(edges[0].data).toMatchObject({ source: 'a', target: 'b' });
    });

    it('drops edges to unknown slugs', () => {
      const { edges } = buildGraphData([
        { slug: 'a', related: ['missing'] }
      ]);
      expect(edges).toHaveLength(0);
    });

    it('dedupes bidirectional related links', () => {
      const { edges } = buildGraphData([
        { slug: 'a', related: ['b'] },
        { slug: 'b', related: ['a'] }
      ]);
      expect(edges).toHaveLength(1);
    });

    it('ignores self-references', () => {
      const { edges } = buildGraphData([{ slug: 'a', related: ['a'] }]);
      expect(edges).toHaveLength(0);
    });

    it('handles orphan docs with no related field', () => {
      const result = buildGraphData([{ slug: 'a' }, { slug: 'b' }]);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(0);
    });
  });
});
