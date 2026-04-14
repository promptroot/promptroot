export function buildGraphData(docs) {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const slugs = new Set(docs.map(d => d.slug));

  for (const doc of docs) {
    nodes.push({
      data: {
        id: doc.slug,
        label: doc.title || doc.slug,
        status: doc.status || 'unknown'
      }
    });
  }

  for (const doc of docs) {
    if (!Array.isArray(doc.related)) continue;
    for (const target of doc.related) {
      if (!slugs.has(target)) continue;
      if (target === doc.slug) continue;
      const key = [doc.slug, target].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ data: { id: `e-${key}`, source: doc.slug, target } });
    }
  }

  return { nodes, edges };
}

let cytoscapePromise = null;

export function loadCytoscape() {
  if (cytoscapePromise) return cytoscapePromise;
  if (typeof window !== 'undefined' && window.cytoscape) {
    cytoscapePromise = Promise.resolve(window.cytoscape);
    return cytoscapePromise;
  }
  cytoscapePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/cytoscape@3.30.2/dist/cytoscape.min.js';
    script.async = true;
    script.onload = () => {
      if (window.cytoscape) resolve(window.cytoscape);
      else reject(new Error('Cytoscape failed to expose global'));
    };
    script.onerror = () => reject(new Error('Failed to load Cytoscape'));
    document.head.appendChild(script);
  });
  return cytoscapePromise;
}

const STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#4a7fff',
      'label': 'data(label)',
      'color': '#e6e8ee',
      'font-size': '11px',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 6,
      'width': 28,
      'height': 28,
      'border-width': 1,
      'border-color': '#1a1d2e'
    }
  },
  { selector: 'node[status = "shipped"]', style: { 'background-color': '#3ec46d' } },
  { selector: 'node[status = "in-progress"]', style: { 'background-color': '#f0a830' } },
  { selector: 'node[status = "proposal"]', style: { 'background-color': '#7c8ff5' } },
  { selector: 'node[status = "archived"]', style: { 'background-color': '#777' } },
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': '#3a3f55',
      'curve-style': 'bezier'
    }
  },
  {
    selector: 'node:selected',
    style: { 'border-width': 3, 'border-color': '#ffd166' }
  }
];

export async function renderGraph({ container, docs, onSelect }) {
  if (!container) return null;
  container.replaceChildren();
  const data = buildGraphData(docs);
  if (data.nodes.length === 0) return null;

  const cytoscape = await loadCytoscape();
  const cy = cytoscape({
    container,
    elements: { nodes: data.nodes, edges: data.edges },
    style: STYLE,
    layout: { name: 'cose', animate: false, padding: 24 }
  });

  cy.on('tap', 'node', evt => {
    const slug = evt.target.id();
    if (onSelect) onSelect(slug);
  });

  return cy;
}
