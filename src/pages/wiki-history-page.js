import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listVersions, getSdd, restoreVersion } from '../modules/wiki-api.js';

const state = {
  tenantId: null,
  slug: null,
  versions: [],
  selectedVersionId: null
};

function $(id) { return document.getElementById(id); }

function setError(msg) {
  const el = $('wikiHistoryError');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

function readQuery() {
  const params = new URL(window.location.href).searchParams;
  return {
    tenantId: params.get('tenant') || params.get('tenantId'),
    slug: params.get('slug')
  };
}

function renderList() {
  const ul = $('wikiHistoryList');
  ul.replaceChildren();
  if (!state.versions.length) {
    $('wikiHistoryEmpty').hidden = false;
    return;
  }
  $('wikiHistoryEmpty').hidden = true;
  state.versions.forEach((v, idx) => {
    const li = document.createElement('li');
    li.className = 'wiki-history-list-item';
    if (state.selectedVersionId === v.versionId) li.classList.add('is-active');

    const label = document.createElement('div');
    label.className = 'wiki-history-list-label';
    label.textContent = idx === 0 ? 'Current' : `v${state.versions.length - idx}`;

    const meta = document.createElement('div');
    meta.className = 'wiki-history-list-meta';
    const when = v.savedAt ? new Date(v.savedAt).toLocaleString() : '';
    meta.textContent = `${v.authorName || v.authorUid} · ${when}`;

    if (v.changeNote) {
      const note = document.createElement('div');
      note.className = 'wiki-history-list-note';
      note.textContent = v.changeNote;
      li.append(label, meta, note);
    } else {
      li.append(label, meta);
    }

    li.addEventListener('click', () => selectVersion(v.versionId));
    ul.appendChild(li);
  });
}

function renderBody(markdown) {
  const html = window.marked ? window.marked.parse(markdown || '') : (markdown || '');
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  $('wikiHistoryDetailBody').innerHTML = safe;
}

async function selectVersion(versionId) {
  state.selectedVersionId = versionId;
  renderList();
  $('wikiHistoryDetailHeader').hidden = false;
  const v = state.versions.find(x => x.versionId === versionId);
  $('wikiHistoryDetailLabel').textContent = `Version ${versionId}`;
  const meta = [];
  if (v?.authorName || v?.authorUid) meta.push(v.authorName || v.authorUid);
  if (v?.savedAt) meta.push(new Date(v.savedAt).toLocaleString());
  $('wikiHistoryDetailMeta').textContent = meta.join(' · ');

  try {
    const sdd = await getSdd({ tenantId: state.tenantId, slug: state.slug, version: versionId });
    renderBody(sdd.body);
  } catch (err) {
    setError(`Failed to load version: ${err.message}`);
  }
}

async function load() {
  setError('');
  try {
    const { versions } = await listVersions({ tenantId: state.tenantId, slug: state.slug });
    state.versions = versions || [];
    renderList();
    if (state.versions[0]) selectVersion(state.versions[0].versionId);
  } catch (err) {
    setError(`Failed to load versions: ${err.message}`);
  }
}

async function handleRestore() {
  if (!state.selectedVersionId) return;
  if (!confirm(`Restore version ${state.selectedVersionId}? This writes a new version, nothing is destroyed.`)) return;
  try {
    await restoreVersion({ tenantId: state.tenantId, slug: state.slug, versionId: state.selectedVersionId });
    await load();
  } catch (err) {
    setError(`Restore failed: ${err.message}`);
  }
}

async function init() {
  initializeSharedComponents('wiki-history');
  const { tenantId, slug } = readQuery();
  if (!tenantId || !slug) {
    setError('Missing ?tenant= or ?slug= in URL');
    return;
  }
  state.tenantId = tenantId;
  state.slug = slug;
  $('wikiHistoryTitle').textContent = `${slug} history`;
  $('wikiHistoryBackLink').href = `/pages/wiki/wiki.html?tenant=${encodeURIComponent(tenantId)}&doc=${encodeURIComponent(slug)}`;
  $('wikiHistoryRestoreBtn').addEventListener('click', handleRestore);

  const auth = getAuth();
  const ready = (user) => {
    if (!user) {
      setError('Sign in to view version history.');
      return;
    }
    load();
  };
  if (auth?.currentUser) ready(auth.currentUser);
  if (auth?.onAuthStateChanged) auth.onAuthStateChanged(ready);
}

document.addEventListener('DOMContentLoaded', init);
