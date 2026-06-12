import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { createSdd, updateSdd, getSdd } from '../modules/wiki-api.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DRAFT_KEY_PREFIX = 'pr.wikiEditDraft.';
const DRAFT_AUTOSAVE_MS = 10_000;

const state = {
  tenantId: null,
  slug: null,
  isNew: true,
  initialBody: '',
  initialFrontmatter: null,
  draftTimer: null,
  unsavedSinceLastDraft: false
};

function $(id) { return document.getElementById(id); }

function setError(msg) {
  const el = $('wikiEditError');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

function setDraftStatus(text) {
  const el = $('wikiEditDraftStatus');
  if (el) el.textContent = text || '';
}

function readQuery() {
  const params = new URL(window.location.href).searchParams;
  return {
    tenantId: params.get('tenant') || params.get('tenantId'),
    slug: params.get('slug')
  };
}

function getDraftKey(tenantId, slug) {
  return `${DRAFT_KEY_PREFIX}${tenantId}.${slug || '__new__'}`;
}

function frontmatterFromInputs() {
  const tagsRaw = $('fmTags').value.trim();
  const relatedRaw = $('fmRelated').value.trim();
  return {
    title: $('fmTitle').value.trim(),
    slug: $('fmSlug').value.trim(),
    date: $('fmDate').value,
    status: $('fmStatus').value,
    owner: $('fmOwner').value.trim(),
    tags: tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    related: relatedRaw ? relatedRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    visibility: $('fmVisibility').value
  };
}

function applyFrontmatter(fm) {
  $('fmTitle').value = fm.title || '';
  $('fmSlug').value = fm.slug || '';
  $('fmDate').value = fm.date || '';
  $('fmStatus').value = fm.status || 'proposal';
  $('fmOwner').value = fm.owner || '';
  $('fmTags').value = Array.isArray(fm.tags) ? fm.tags.join(', ') : '';
  $('fmRelated').value = Array.isArray(fm.related) ? fm.related.join(', ') : '';
  $('fmVisibility').value = fm.visibility || 'public';
}

function renderPreview() {
  const body = $('wikiEditTextarea').value;
  const html = window.marked ? window.marked.parse(body) : body;
  const safe = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  const pane = document.querySelector('.wiki-edit-pane--preview');
  pane.innerHTML = safe;
}

function bindTabs() {
  const tabs = document.querySelectorAll('.wiki-edit-tab');
  const panes = document.querySelectorAll('.wiki-edit-pane');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    const target = tab.dataset.pane;
    tabs.forEach(t => {
      const active = t.dataset.pane === target;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    panes.forEach(p => {
      p.hidden = p.dataset.pane !== target;
    });
    if (target === 'preview') renderPreview();
  }));
}

function saveDraft() {
  if (!state.tenantId) return;
  const draft = {
    frontmatter: frontmatterFromInputs(),
    body: $('wikiEditTextarea').value,
    changeNote: $('changeNote').value,
    savedAt: Date.now()
  };
  try {
    localStorage.setItem(getDraftKey(state.tenantId, state.slug), JSON.stringify(draft));
    setDraftStatus('Draft saved locally');
  } catch { /* ignore quota */ }
  state.unsavedSinceLastDraft = false;
}

function loadDraft() {
  if (!state.tenantId) return null;
  try {
    const raw = localStorage.getItem(getDraftKey(state.tenantId, state.slug));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearDraft() {
  if (!state.tenantId) return;
  localStorage.removeItem(getDraftKey(state.tenantId, state.slug));
}

function startAutoSave() {
  if (state.draftTimer) clearInterval(state.draftTimer);
  state.draftTimer = setInterval(() => {
    if (state.unsavedSinceLastDraft) saveDraft();
  }, DRAFT_AUTOSAVE_MS);
}

function bindAutoSaveTriggers() {
  const ids = ['fmTitle', 'fmSlug', 'fmDate', 'fmStatus', 'fmOwner', 'fmTags', 'fmRelated', 'fmVisibility', 'changeNote', 'wikiEditTextarea'];
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state.unsavedSinceLastDraft = true;
      setDraftStatus('Editing...');
    });
    el.addEventListener('change', () => {
      state.unsavedSinceLastDraft = true;
      setDraftStatus('Editing...');
    });
  });
}

async function save() {
  setError('');
  const fm = frontmatterFromInputs();
  if (!fm.title) { setError('Title is required'); return; }
  if (!SLUG_PATTERN.test(fm.slug)) { setError('Slug must be lowercase kebab-case'); return; }
  if (!fm.date) { setError('Date is required'); return; }
  if (!fm.owner) { setError('Owner is required'); return; }

  const body = $('wikiEditTextarea').value;
  const changeNote = $('changeNote').value.trim() || null;

  const btn = $('wikiEditSaveBtn');
  btn.disabled = true;
  try {
    if (state.isNew) {
      const result = await createSdd({
        tenantId: state.tenantId,
        slug: fm.slug,
        frontmatter: fm,
        body,
        changeNote
      });
      clearDraft();
      const target = `/pages/wiki/wiki.html?tenant=${encodeURIComponent(state.tenantId)}&doc=${encodeURIComponent(result.slug)}`;
      window.location.href = target;
    } else {
      await updateSdd({
        tenantId: state.tenantId,
        slug: state.slug,
        frontmatter: fm,
        body,
        changeNote
      });
      clearDraft();
      const target = `/pages/wiki/wiki.html?tenant=${encodeURIComponent(state.tenantId)}&doc=${encodeURIComponent(state.slug)}`;
      window.location.href = target;
    }
  } catch (err) {
    setError(err.message || 'Save failed');
    btn.disabled = false;
  }
}

function cancel() {
  if (state.unsavedSinceLastDraft && !confirm('Discard unsaved changes?')) return;
  const dest = state.tenantId
    ? `/pages/wiki/wiki.html?tenant=${encodeURIComponent(state.tenantId)}${state.slug ? `&doc=${encodeURIComponent(state.slug)}` : ''}`
    : '/pages/wiki/wiki.html';
  window.location.href = dest;
}

async function loadExisting() {
  try {
    const sdd = await getSdd({ tenantId: state.tenantId, slug: state.slug });
    state.initialBody = sdd.body || '';
    state.initialFrontmatter = {
      title: sdd.title,
      slug: sdd.slug,
      date: sdd.date,
      status: sdd.status,
      owner: sdd.owner,
      tags: sdd.tags || [],
      related: sdd.related || [],
      visibility: sdd.visibility
    };
    applyFrontmatter(state.initialFrontmatter);
    $('fmSlug').readOnly = true;
    $('wikiEditTextarea').value = state.initialBody;
    $('wikiEditTitle').textContent = `Edit ${sdd.slug}`;
  } catch (err) {
    setError(`Failed to load Spec: ${err.message}`);
  }
}

function applyDraftIfNewer() {
  const draft = loadDraft();
  if (!draft) return;
  const current = $('wikiEditTextarea').value;
  if (draft.body && draft.body !== current) {
    if (confirm('A local draft exists for this Spec. Restore it?')) {
      applyFrontmatter(draft.frontmatter || {});
      $('wikiEditTextarea').value = draft.body;
      $('changeNote').value = draft.changeNote || '';
    } else {
      clearDraft();
    }
  }
}

async function init() {
  initializeSharedComponents('wiki-edit');
  bindTabs();
  bindAutoSaveTriggers();
  $('wikiEditSaveBtn').addEventListener('click', save);
  $('wikiEditCancelBtn').addEventListener('click', cancel);

  const { tenantId, slug } = readQuery();
  if (!tenantId) {
    setError('Missing ?tenant=... in URL');
    return;
  }
  state.tenantId = tenantId;
  state.slug = slug;
  state.isNew = !slug;

  const auth = getAuth();
  const onUser = async (user) => {
    if (!user) {
      $('wikiEditNotSignedIn').hidden = false;
      return;
    }
    $('wikiEditNotSignedIn').hidden = true;
    if (state.isNew) {
      $('wikiEditTitle').textContent = `New Spec in ${tenantId}`;
      $('fmDate').value = new Date().toISOString().slice(0, 10);
      $('fmOwner').value = user.displayName || user.email || '';
    } else {
      await loadExisting();
    }
    applyDraftIfNewer();
    startAutoSave();
  };

  if (auth?.currentUser) onUser(auth.currentUser);
  if (auth?.onAuthStateChanged) auth.onAuthStateChanged(onUser);
  else if (!auth?.currentUser) $('wikiEditNotSignedIn').hidden = false;
}

document.addEventListener('DOMContentLoaded', init);
