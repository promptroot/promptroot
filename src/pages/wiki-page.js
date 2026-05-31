import { TIMEOUTS } from '../utils/constants.js';
import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listSdds, getSdd, deleteSdd, listTenants } from '../modules/wiki-api.js';
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
import { showConfirm } from '../modules/confirm-modal.js';
import { debounce } from '../utils/debounce.js';

let allDocs = [];
let visibleDocs = [];
let currentSlug = null;
let currentBodyMarkdown = null;
let currentView = 'doc';
let graphRendered = false;
let canSeePrivate = false;
let isMember = false;
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
  elements.editBtn = document.getElementById('wikiEditBtn');
  elements.deleteBtn = document.getElementById('wikiDeleteBtn');
  elements.historyBtn = document.getElementById('wikiHistoryBtn');
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
    updateMemberActions(slug);
    updateHistoryAction(slug);
  } catch (err) {
    console.error('Failed to render doc', err);
    showToast('Failed to load Spec', 'error');
  }
}

function updateHistoryAction(slug) {
  if (!elements.historyBtn) return;
  const show = !!tenantId && !!slug;
  if (show) {
    elements.historyBtn.href = `/pages/wiki-history/wiki-history.html?tenant=${encodeURIComponent(tenantId)}&slug=${encodeURIComponent(slug)}`;
  }
  elements.historyBtn.hidden = !show;
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

function updateMemberActions(slug) {
  if (!elements.editBtn || !elements.deleteBtn) return;
  const show = isMember && !!tenantId && !!slug;
  if (show) {
    const editUrl = `/pages/wiki-edit/wiki-edit.html?tenant=${encodeURIComponent(tenantId)}&slug=${encodeURIComponent(slug)}`;
    elements.editBtn.href = editUrl;
  }
  elements.editBtn.hidden = !show;
  elements.deleteBtn.hidden = !show;
}

function bindMemberActions() {
  if (!elements.deleteBtn) return;
  elements.deleteBtn.addEventListener('click', async () => {
    const slug = currentSlug;
    if (!slug || !tenantId) return;
    const confirmed = await showConfirm(`Permanently delete "${slug}"? This cannot be undone.`, {
      title: 'Delete Spec',
      confirmText: 'Delete',
      confirmStyle: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteSdd({ tenantId, slug });
      allDocs = allDocs.filter(d => d.slug !== slug);
      currentSlug = null;
      applyVisibility();
      if (elements.placeholder) elements.placeholder.hidden = false;
      if (elements.header) elements.header.hidden = true;
      if (elements.bodyEl) elements.bodyEl.hidden = true;
      history.replaceState(null, '', location.pathname + location.search);
      showToast(`"${slug}" deleted`, 'success');
    } catch (err) {
      showToast(`Delete failed: ${err?.message || 'unknown error'}`, 'error');
    }
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
    await waitForAuthUser();
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

function waitForAuthUser() {
  return new Promise((resolve) => {
    const auth = getAuth();
    if (auth?.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    if (!auth?.onAuthStateChanged) {
      resolve(null);
      return;
    }
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

function setTreeMessage(text) {
  if (!elements.tree) return;
  elements.tree.textContent = '';
  const msg = document.createElement('div');
  msg.className = 'wiki-tree-empty';
  msg.textContent = text;
  elements.tree.appendChild(msg);
}

function showEmptyTenantState() {
  setTreeMessage(`No Specs in tenant "${tenantId}" yet.`);
  if (elements.placeholder) {
    elements.placeholder.hidden = false;
    const heading = elements.placeholder.querySelector('p');
    if (heading) {
      heading.textContent = `No Specs in "${tenantId}" yet — create the first one.`;
    }
  }
}

function showSignedOutState() {
  setTreeMessage(`Sign in to view Specs in "${tenantId}".`);
  if (elements.placeholder) {
    elements.placeholder.hidden = false;
    const heading = elements.placeholder.querySelector('p');
    if (heading) heading.textContent = 'Sign in to browse this tenant.';
  }
}

function applyTenantToToolbar() {
  const backRow = document.getElementById('wikiBackRow');
  if (backRow) backRow.hidden = !tenantId;
  if (!tenantId) return;
  const newSddBtn = document.querySelector('.toolbar-actions a[href*="wiki-edit"]');
  if (newSddBtn) {
    newSddBtn.href = `/pages/wiki-edit/wiki-edit.html?tenant=${encodeURIComponent(tenantId)}`;
  }
}

async function showTenantPicker() {
  const layout = document.querySelector('.wiki-layout');
  const toolbar = document.querySelector('.wiki-toolbar');
  if (toolbar) toolbar.hidden = true;
  if (layout) layout.hidden = true;

  const main = document.querySelector('main.card.pad-lg');
  if (!main) return;

  const picker = document.createElement('section');
  picker.className = 'wiki-picker';

  const about = document.createElement('p');
  about.className = 'wiki-picker-about';
  about.textContent = 'A versioned home for your Software Design Documents (specs). Browse, search, and cross-link them, then let agents pull spec context through the MCP server, RAG API, or Claude Code skill.';
  picker.appendChild(about);

  const head = document.createElement('div');
  head.className = 'wiki-picker-head';

  const intro = document.createElement('p');
  intro.className = 'wiki-picker-intro';
  intro.textContent = 'Pick a wiki to browse specs, or create a new one.';
  head.appendChild(intro);

  const newBtn = document.createElement('a');
  newBtn.className = 'btn sm primary';
  newBtn.href = '/pages/tenants/tenants.html';
  const newIcon = document.createElement('span');
  newIcon.className = 'icon icon-inline';
  newIcon.setAttribute('aria-hidden', 'true');
  newIcon.textContent = 'add';
  newBtn.appendChild(newIcon);
  newBtn.append(' New wiki');
  head.appendChild(newBtn);

  picker.appendChild(head);

  const status = document.createElement('div');
  status.className = 'wiki-picker-status';
  status.textContent = 'Loading…';
  picker.appendChild(status);

  const list = document.createElement('ul');
  list.className = 'wiki-picker-list';
  list.hidden = true;
  picker.appendChild(list);

  main.appendChild(picker);

  await waitForAuthUser();
  const auth = getAuth();
  if (!auth?.currentUser) {
    status.textContent = 'Sign in to see your wikis.';
    return;
  }

  let tenants;
  try {
    ({ tenants } = await listTenants());
  } catch (err) {
    status.textContent = `Failed to load tenants: ${err?.message || 'unknown error'}`;
    return;
  }

  if (!tenants || tenants.length === 0) {
    status.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'wiki-picker-empty';
    const p = document.createElement('p');
    p.textContent = "You don't belong to any wikis yet.";
    const link = document.createElement('a');
    link.className = 'btn sm primary';
    link.href = '/pages/tenants/tenants.html';
    link.textContent = 'Create one →';
    empty.appendChild(p);
    empty.appendChild(link);
    picker.appendChild(empty);
    return;
  }

  status.hidden = true;
  list.hidden = false;

  for (const t of tenants) {
    const li = document.createElement('li');
    li.className = 'wiki-picker-item';

    const link = document.createElement('a');
    link.className = 'wiki-picker-link';
    link.href = `/pages/wiki/wiki.html?tenant=${encodeURIComponent(t.slug)}`;

    const name = document.createElement('div');
    name.className = 'wiki-picker-name';
    name.textContent = t.name || t.slug;
    link.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'wiki-picker-meta';
    const slugEl = document.createElement('code');
    slugEl.textContent = t.slug;
    meta.appendChild(slugEl);
    meta.appendChild(document.createTextNode(' · '));
    const vis = document.createElement('span');
    vis.textContent = t.visibility || 'private';
    meta.appendChild(vis);
    if (typeof t.memberCount === 'number') {
      meta.appendChild(document.createTextNode(' · '));
      const members = document.createElement('span');
      members.textContent = `${t.memberCount} member${t.memberCount === 1 ? '' : 's'}`;
      meta.appendChild(members);
    }
    link.appendChild(meta);

    if (t.description) {
      const desc = document.createElement('div');
      desc.className = 'wiki-picker-desc';
      desc.textContent = t.description;
      link.appendChild(desc);
    }

    li.appendChild(link);
    list.appendChild(li);
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
    titleEl.append(` Specs — ${tenantId}`);
  }
}

async function initApp() {
  cacheElements();
  configureWikiRenderer({ canSeePrivate: () => canSeePrivate });

  tenantId = readTenantParam();
  applyTenantToToolbar();
  applyTenantTitle();

  if (!tenantId) {
    await showTenantPicker();
    return;
  }

  try {
    allDocs = await loadDocsForCurrentScope();
  } catch (err) {
    console.error('Failed to load wiki index', err);
    if (tenantId && err?.message === 'Not signed in') {
      showSignedOutState();
    } else {
      setTreeMessage(tenantId
        ? `Failed to load Specs for tenant "${tenantId}": ${err?.message || 'unknown error'}`
        : 'Failed to load wiki index.');
    }
    return;
  }

  if (tenantId && allDocs.length === 0) {
    showEmptyTenantState();
    return;
  }

  applyVisibility();
  bindTabs();
  bindSearch();
  bindCopyButton();
  bindMemberActions();
  window.addEventListener('hashchange', handleHashChange);

  const initialSlug = location.hash.replace(/^#/, '');
  if (initialSlug && findDocBySlug(visibleDocs, initialSlug)) {
    selectDoc(initialSlug);
  }

  try {
    const auth = getAuth();
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(user => {
        const nextPrivate = !!user;
        const nextMember = !!tenantId && !!user;
        const visibilityChanged = nextPrivate !== canSeePrivate;
        canSeePrivate = nextPrivate;
        isMember = nextMember;
        if (visibilityChanged) applyVisibility();
        updateMemberActions(currentSlug);
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
