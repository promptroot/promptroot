import { TIMEOUTS } from '../utils/constants.js';
import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listSdds, getSdd } from '../modules/wiki-api.js';
import {
  loadWikiIndex,
  filterDocsByVisibility,
  findDocBySlug,
  getRelatedDocs
} from '../modules/wiki-index.js';
import {
  configureWikiRenderer,
  fetchDocMarkdown,
  stripFrontmatter,
  renderDoc,
  paintDoc,
  buildAgentContextMarkdown
} from '../modules/wiki-renderer.js';
import { sanitizeHtml } from '../modules/prompt-renderer.js';
import { loadMarked } from '../utils/lazy-loaders.js';
import { renderTree, setActiveTreeItem } from '../modules/wiki-tree.js';
import { renderTimeline } from '../modules/wiki-timeline.js';
import { renderGraph } from '../modules/wiki-graph.js';
import { searchDocs, renderSearchResults } from '../modules/wiki-search.js';
import { copyText } from '../utils/clipboard.js';
import { showToast } from '../modules/toast.js';
import { debounce } from '../utils/debounce.js';

let allDocs = [];
let visibleDocs = [];
let currentSlug = null;
let currentBodyMarkdown = null;
let currentView = 'doc';
let graphRendered = false;
let canSeePrivate = false;
let tenantId = null;

const elements = {};

function cacheElements() {
  elements.tree = document.getElementById('wikiTree');
  elements.placeholder = document.getElementById('wikiDocPlaceholder');
  elements.header = document.getElementById('wikiDocHeader');
  elements.titleEl = document.getElementById('wikiDocTitle');
  elements.dateEl = document.getElementById('wikiDocDate');
  elements.statusEl = document.getElementById('wikiDocStatus');
  elements.ownerEl = document.getElementById('wikiDocOwner');
  elements.tagsEl = document.getElementById('wikiDocTags');
  elements.bodyEl = document.getElementById('wikiDocBody');
  elements.related = document.getElementById('wikiRelatedDocs');
  elements.relatedList = document.getElementById('wikiRelatedList');
  elements.docView = document.getElementById('wikiDocView');
  elements.timelineView = document.getElementById('wikiTimelineView');
  elements.graphView = document.getElementById('wikiGraphView');
  elements.graphContainer = document.getElementById('wikiGraphContainer');
  elements.searchInput = document.getElementById('wikiSearchInput');
  elements.searchResults = document.getElementById('wikiSearchResults');
  elements.tabs = document.querySelectorAll('.wiki-view-tab');
  elements.copyBtn = document.getElementById('wikiCopyContextBtn');
}

function setView(view) {
  currentView = view;
  elements.tabs.forEach(tab => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if (elements.docView) elements.docView.hidden = view !== 'doc';
  if (elements.timelineView) elements.timelineView.hidden = view !== 'timeline';
  if (elements.graphView) elements.graphView.hidden = view !== 'graph';

  if (view === 'timeline') {
    renderTimeline({
      container: elements.timelineView,
      docs: visibleDocs,
      onSelect: slug => { setView('doc'); selectDoc(slug); }
    });
  } else if (view === 'graph') {
    if (!graphRendered) {
      renderGraph({
        container: elements.graphContainer,
        docs: visibleDocs,
        onSelect: slug => { setView('doc'); selectDoc(slug); }
      }).then(() => { graphRendered = true; })
        .catch(err => console.error('Graph render failed', err));
    }
  }
}

async function selectDoc(slug) {
  const doc = findDocBySlug(visibleDocs, slug);
  if (!doc) return;
  currentSlug = slug;
  setActiveTreeItem(elements.tree, slug);
  if (location.hash.replace(/^#/, '') !== slug) {
    history.replaceState(null, '', `#${slug}`);
  }
  try {
    let html;
    let blocked = false;
    if (tenantId) {
      if (doc.visibility === 'private' && !canSeePrivate) {
        blocked = true;
        currentBodyMarkdown = null;
      } else {
        const result = await getSdd({ tenantId, slug });
        currentBodyMarkdown = result.body || '';
        const marked = await loadMarked();
        html = sanitizeHtml(marked.parse(currentBodyMarkdown));
      }
    } else {
      const rendered = await renderDoc(doc);
      html = rendered.html;
      blocked = rendered.blocked;
      if (!blocked) {
        const raw = await fetchDocMarkdown(doc.docPath);
        currentBodyMarkdown = stripFrontmatter(raw);
      } else {
        currentBodyMarkdown = null;
      }
    }
    paintDoc({
      doc,
      html,
      blocked,
      elements,
      relatedDocs: getRelatedDocs(visibleDocs, slug)
    });
  } catch (err) {
    console.error('Failed to render doc', err);
    showToast('Failed to load SDD', 'error');
  }
}

function rebuildTree() {
  renderTree({
    container: elements.tree,
    docs: visibleDocs,
    activeSlug: currentSlug,
    onSelect: selectDoc
  });
}

function handleHashChange() {
  const slug = location.hash.replace(/^#/, '');
  if (!slug) return;
  if (slug !== currentSlug) selectDoc(slug);
}

function bindSearch() {
  if (!elements.searchInput || !elements.searchResults) return;
  const handler = debounce(() => {
    const q = elements.searchInput.value.trim();
    if (q.length === 0) {
      elements.searchResults.hidden = true;
      return;
    }
    const results = searchDocs(visibleDocs, q);
    elements.searchResults.hidden = false;
    renderSearchResults({
      container: elements.searchResults,
      results,
      onSelect: slug => {
        elements.searchInput.value = '';
        elements.searchResults.hidden = true;
        setView('doc');
        selectDoc(slug);
      }
    });
  }, 150);
  elements.searchInput.addEventListener('input', handler);
}

function bindTabs() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  });
}

function bindCopyButton() {
  if (!elements.copyBtn) return;
  elements.copyBtn.addEventListener('click', async () => {
    const doc = findDocBySlug(visibleDocs, currentSlug);
    if (!doc || !currentBodyMarkdown) return;
    const md = buildAgentContextMarkdown(doc, currentBodyMarkdown, getRelatedDocs(visibleDocs, currentSlug));
    const ok = await copyText(md);
    showToast(ok ? 'Copied agent context to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });
}

function applyVisibility() {
  visibleDocs = filterDocsByVisibility(allDocs, canSeePrivate);
  rebuildTree();
  graphRendered = false;
  if (currentView === 'timeline' || currentView === 'graph') {
    setView(currentView);
  }
}

function readTenantParam() {
  try {
    return new URL(window.location.href).searchParams.get('tenant') || null;
  } catch {
    return null;
  }
}

async function loadDocsForCurrentScope() {
  if (tenantId) {
    const { sdds } = await listSdds(tenantId);
    return (sdds || []).map(s => ({
      slug: s.slug,
      title: s.title,
      status: s.status,
      owner: s.owner,
      date: s.date,
      tags: s.tags || [],
      related: s.related || [],
      visibility: s.visibility
    }));
  }
  const index = await loadWikiIndex();
  return index.docs || [];
}

function applyTenantToToolbar() {
  if (!tenantId) return;
  const newSddBtn = document.querySelector('.toolbar-actions a[href*="wiki-edit"]');
  if (newSddBtn) {
    newSddBtn.href = `/pages/wiki-edit/wiki-edit.html?tenant=${encodeURIComponent(tenantId)}`;
  }
}

function applyTenantTitle() {
  if (!tenantId) return;
  const titleEl = document.querySelector('.section-title-lg');
  if (titleEl) {
    titleEl.textContent = '';
    const icon = document.createElement('span');
    icon.className = 'icon icon-inline';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'menu_book';
    titleEl.appendChild(icon);
    titleEl.append(` Wiki — ${tenantId}`);
  }
}

async function initApp() {
  cacheElements();
  configureWikiRenderer({ canSeePrivate: () => canSeePrivate });

  tenantId = readTenantParam();
  applyTenantToToolbar();
  applyTenantTitle();

  try {
    allDocs = await loadDocsForCurrentScope();
  } catch (err) {
    console.error('Failed to load wiki index', err);
    if (elements.tree) {
      elements.tree.textContent = tenantId
        ? `Failed to load SDDs for tenant "${tenantId}".`
        : 'Failed to load wiki index.';
    }
    return;
  }

  applyVisibility();
  bindTabs();
  bindSearch();
  bindCopyButton();
  window.addEventListener('hashchange', handleHashChange);

  const initialSlug = location.hash.replace(/^#/, '');
  if (initialSlug && findDocBySlug(visibleDocs, initialSlug)) {
    selectDoc(initialSlug);
  }

  try {
    const auth = getAuth();
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(user => {
        const next = !!user;
        if (next !== canSeePrivate) {
          canSeePrivate = next;
          applyVisibility();
        }
      });
    }
  } catch (err) {
    console.warn('Auth not available; private docs hidden', err);
  }
}

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

function bootstrap() {
  initializeSharedComponents('wiki');
  waitForComponents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
