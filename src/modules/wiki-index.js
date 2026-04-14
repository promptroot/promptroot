const INDEX_URL = '/docs/sdd/_index.json';

let cachedIndex = null;
let inflight = null;

export async function loadWikiIndex({ fetchImpl = fetch, url = INDEX_URL } = {}) {
  if (cachedIndex) return cachedIndex;
  if (inflight) return inflight;

  inflight = (async () => {
    const resp = await fetchImpl(url, { cache: 'no-cache' });
    if (!resp.ok) {
      inflight = null;
      throw new Error(`Failed to load wiki index: ${resp.status}`);
    }
    const data = await resp.json();
    if (!data || !Array.isArray(data.docs)) {
      inflight = null;
      throw new Error('Wiki index malformed: missing docs array');
    }
    cachedIndex = data;
    inflight = null;
    return data;
  })();

  return inflight;
}

export function resetWikiIndexCache() {
  cachedIndex = null;
  inflight = null;
}

export function filterDocsByVisibility(docs, canSeePrivate) {
  if (!Array.isArray(docs)) return [];
  if (canSeePrivate) return docs.slice();
  return docs.filter(d => d.visibility !== 'private');
}

export function findDocBySlug(docs, slug) {
  if (!Array.isArray(docs) || !slug) return null;
  return docs.find(d => d.slug === slug) || null;
}

export function getRelatedDocs(docs, slug) {
  const doc = findDocBySlug(docs, slug);
  if (!doc || !Array.isArray(doc.related)) return [];
  return doc.related
    .map(s => findDocBySlug(docs, s))
    .filter(Boolean);
}
