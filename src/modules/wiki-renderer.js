import { sanitizeHtml } from './prompt-renderer.js';
import { loadMarked } from '../utils/lazy-loaders.js';
import { clearElement, createElement } from '../utils/dom-helpers.js';

let canSeePrivateFn = () => false;

export function configureWikiRenderer({ canSeePrivate } = {}) {
  if (typeof canSeePrivate === 'function') canSeePrivateFn = canSeePrivate;
}

export async function fetchDocMarkdown(docPath, { fetchImpl = fetch } = {}) {
  const url = '/' + docPath.replace(/^\/+/, '');
  const resp = await fetchImpl(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return resp.text();
}

export function stripFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return text;
  const close = text.indexOf('\n---', 4);
  if (close === -1) return text;
  return text.slice(close + 4).replace(/^\r?\n/, '');
}

export async function renderDoc(doc, { fetchImpl = fetch } = {}) {
  if (!doc) throw new Error('renderDoc: doc is required');
  if (doc.visibility === 'private' && !canSeePrivateFn()) {
    return { html: null, blocked: true };
  }

  const raw = await fetchDocMarkdown(doc.docPath, { fetchImpl });
  const body = stripFrontmatter(raw);

  const marked = await loadMarked();
  const rawHtml = marked.parse(body);
  const html = sanitizeHtml(rawHtml);

  return { html, blocked: false };
}

export function paintDoc({ doc, html, blocked, elements, relatedDocs }) {
  const {
    placeholder, header, titleEl, dateEl, statusEl, ownerEl, tagsEl,
    bodyEl, related, relatedList
  } = elements;

  if (placeholder) placeholder.hidden = true;
  if (header) header.hidden = false;
  if (bodyEl) bodyEl.hidden = false;

  if (titleEl) titleEl.textContent = doc.title || doc.slug;
  if (dateEl) dateEl.textContent = doc.date || '';
  if (statusEl) {
    statusEl.textContent = doc.status || '';
    statusEl.dataset.status = doc.status || '';
  }
  if (ownerEl) ownerEl.textContent = doc.owner ? `@${doc.owner}` : '';
  if (tagsEl) {
    clearElement(tagsEl);
    (doc.tags || []).forEach(tag => {
      tagsEl.appendChild(createElement('span', 'wiki-tag', tag));
    });
  }

  if (bodyEl) {
    if (blocked) {
      clearElement(bodyEl);
      bodyEl.appendChild(createElement('div', 'wiki-private-notice',
        'This document is private. Sign in to view.'));
    } else {
      bodyEl.innerHTML = html;
    }
  }

  if (related && relatedList) {
    clearElement(relatedList);
    if (Array.isArray(relatedDocs) && relatedDocs.length > 0) {
      related.hidden = false;
      relatedDocs.forEach(rel => {
        const li = createElement('li');
        const a = createElement('a', '', rel.title || rel.slug);
        a.href = `#${rel.slug}`;
        a.dataset.slug = rel.slug;
        li.appendChild(a);
        relatedList.appendChild(li);
      });
    } else {
      related.hidden = true;
    }
  }
}

export function buildAgentContextMarkdown(doc, body, relatedDocs) {
  const lines = [];
  lines.push(`# ${doc.title}`);
  lines.push('');
  lines.push(`Source: https://promptroot.ai/wiki#${doc.slug}`);
  lines.push(`Status: ${doc.status} | Date: ${doc.date} | Owner: ${doc.owner}`);
  if (doc.tags && doc.tags.length) lines.push(`Tags: ${doc.tags.join(', ')}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(body);
  if (Array.isArray(relatedDocs) && relatedDocs.length > 0) {
    lines.push('');
    lines.push('## Related Specs');
    lines.push('');
    relatedDocs.forEach(rel => {
      lines.push(`- [${rel.title}](https://promptroot.ai/wiki#${rel.slug}) (${rel.status})`);
    });
  }
  return lines.join('\n');
}
