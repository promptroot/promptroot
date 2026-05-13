import { createElement, clearElement } from '../utils/dom-helpers.js';

export function groupDocsByStatus(docs) {
  const order = ['in-progress', 'approved', 'proposal', 'shipped', 'archived'];
  const groups = new Map(order.map(s => [s, []]));
  for (const doc of docs) {
    if (!groups.has(doc.status)) groups.set(doc.status, []);
    groups.get(doc.status).push(doc);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  return groups;
}

export function renderTree({ container, docs, activeSlug, onSelect }) {
  if (!container) return;
  clearElement(container);
  if (!docs || docs.length === 0) {
    container.appendChild(createElement('p', 'wiki-tree-empty', 'No SDDs available.'));
    return;
  }

  const groups = groupDocsByStatus(docs);
  for (const [status, list] of groups) {
    if (list.length === 0) continue;
    const section = createElement('div', 'wiki-tree-group');
    section.appendChild(createElement('div', 'wiki-tree-group-label', status));

    const ul = createElement('ul', 'wiki-tree-list');
    list.forEach(doc => {
      const li = createElement('li', 'wiki-tree-item');
      const btn = createElement('button', 'wiki-tree-link', doc.title || doc.slug);
      btn.type = 'button';
      btn.dataset.slug = doc.slug;
      btn.setAttribute('role', 'treeitem');
      if (doc.slug === activeSlug) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-current', 'true');
      }
      if (doc.private || doc.visibility === 'private') {
        const lock = createElement('span', 'wiki-tree-lock', 'lock');
        lock.classList.add('icon');
        lock.setAttribute('aria-hidden', 'true');
        btn.prepend(lock);
      }
      btn.addEventListener('click', () => onSelect && onSelect(doc.slug));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    container.appendChild(section);
  }
}

export function setActiveTreeItem(container, slug) {
  if (!container) return;
  container.querySelectorAll('.wiki-tree-link').forEach(btn => {
    const isActive = btn.dataset.slug === slug;
    btn.classList.toggle('is-active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}
