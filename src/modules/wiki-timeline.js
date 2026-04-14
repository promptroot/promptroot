import { createElement, clearElement } from '../utils/dom-helpers.js';

export function groupDocsByMonth(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const key = (doc.date || '0000-00').slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map(key => ({ month: key, docs: groups.get(key) }));
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(yearMonth) {
  const m = yearMonth.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yearMonth;
  const monthIdx = parseInt(m[2], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return yearMonth;
  return `${MONTH_NAMES[monthIdx]} ${m[1]}`;
}

export function renderTimeline({ container, docs, onSelect }) {
  if (!container) return;
  clearElement(container);
  if (!docs || docs.length === 0) {
    container.appendChild(createElement('p', 'wiki-tree-empty', 'No SDDs to show on the timeline.'));
    return;
  }
  const grouped = groupDocsByMonth(docs);
  for (const { month, docs: monthDocs } of grouped) {
    const section = createElement('section', 'wiki-timeline-month');
    section.appendChild(createElement('h3', 'wiki-timeline-month-label', formatMonth(month)));
    const ul = createElement('ul', 'wiki-timeline-list');
    monthDocs.forEach(doc => {
      const li = createElement('li', 'wiki-timeline-item');
      const btn = createElement('button', 'wiki-timeline-link');
      btn.type = 'button';
      btn.dataset.slug = doc.slug;

      const title = createElement('span', 'wiki-timeline-title', doc.title || doc.slug);
      const meta = createElement('span', 'wiki-timeline-meta', `${doc.date || ''} · ${doc.status || ''}`);
      btn.appendChild(title);
      btn.appendChild(meta);
      btn.addEventListener('click', () => onSelect && onSelect(doc.slug));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    container.appendChild(section);
  }
}
