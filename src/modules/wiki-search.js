import { createElement, clearElement } from '../utils/dom-helpers.js';

export function tokenizeQuery(q) {
  if (!q) return [];
  return q.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1);
}

export function searchDocs(docs, query) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];
  const results = [];
  for (const doc of docs) {
    const haystack = [
      doc.title || '',
      doc.slug || '',
      (doc.tags || []).join(' '),
      (doc.headings || []).map(h => h.text).join(' ')
    ].join(' ').toLowerCase();

    let score = 0;
    const matchedTokens = new Set();
    for (const tok of tokens) {
      if (haystack.includes(tok)) {
        matchedTokens.add(tok);
        if ((doc.title || '').toLowerCase().includes(tok)) score += 5;
        if ((doc.tags || []).some(t => t.toLowerCase().includes(tok))) score += 3;
        if ((doc.headings || []).some(h => h.text.toLowerCase().includes(tok))) score += 2;
        score += 1;
      }
    }
    if (matchedTokens.size === tokens.length) {
      results.push({ doc, score });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

export function renderSearchResults({ container, results, onSelect }) {
  if (!container) return;
  clearElement(container);
  if (results.length === 0) {
    container.appendChild(createElement('p', 'wiki-search-empty', 'No matches.'));
    return;
  }
  const ul = createElement('ul', 'wiki-search-list');
  results.forEach(({ doc }) => {
    const li = createElement('li', 'wiki-search-item');
    const btn = createElement('button', 'wiki-search-link');
    btn.type = 'button';
    btn.dataset.slug = doc.slug;
    btn.appendChild(createElement('span', 'wiki-search-title', doc.title || doc.slug));
    btn.appendChild(createElement('span', 'wiki-search-meta', `${doc.date || ''} · ${doc.status || ''}`));
    btn.addEventListener('click', () => onSelect && onSelect(doc.slug));
    li.appendChild(btn);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}
