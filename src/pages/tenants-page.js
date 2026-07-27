import { initializeSharedComponents, waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listTenants, createTenant, updateTenant, deleteTenant } from '../modules/wiki-api.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { showToast } from '../modules/toast.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let currentUid = null;

function $(id) { return document.getElementById(id); }

function setStatus(message, level) {
  const el = $('tenantsCreateStatus');
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.dataset.level = level || 'info';
}

function clearStatus() {
  const el = $('tenantsCreateStatus');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
  delete el.dataset.level;
}

function showSignedOutState() {
  $('tenantsNotSignedIn').hidden = false;
  $('tenantsLoading').hidden = true;
  $('tenantsList').hidden = true;
  $('tenantsEmpty').hidden = true;
  $('tenantsCreateForm').hidden = true;
}

function showSignedInState() {
  $('tenantsNotSignedIn').hidden = true;
  $('tenantsCreateForm').hidden = false;
}

function renderTenants(tenants) {
  const listEl = $('tenantsList');
  const emptyEl = $('tenantsEmpty');
  const loadingEl = $('tenantsLoading');
  loadingEl.hidden = true;
  listEl.replaceChildren();

  if (!tenants || tenants.length === 0) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  listEl.hidden = false;

  for (const tenant of tenants) {
    const li = document.createElement('li');
    li.className = 'tenants-list-item';

    const main = document.createElement('div');
    main.className = 'tenants-list-main';

    const name = document.createElement('div');
    name.className = 'tenants-list-name';
    name.textContent = tenant.name;
    main.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'tenants-list-meta';
    const slugEl = document.createElement('code');
    slugEl.textContent = tenant.slug;
    meta.appendChild(slugEl);

    if (typeof tenant.memberCount === 'number') {
      const members = document.createElement('span');
      members.className = 'tenants-list-members';
      members.textContent = `${tenant.memberCount} member${tenant.memberCount === 1 ? '' : 's'}`;
      meta.appendChild(document.createTextNode(' '));
      meta.appendChild(members);
    }

    main.appendChild(meta);

    if (tenant.description) {
      const desc = document.createElement('div');
      desc.className = 'tenants-list-desc';
      desc.textContent = tenant.description;
      main.appendChild(desc);
    }

    if (tenant.githubRepo) {
      const repo = document.createElement('div');
      repo.className = 'tenants-list-repo';
      repo.textContent = `Mirror: ${tenant.githubRepo}`;
      main.appendChild(repo);
    }

    li.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'tenants-list-actions';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn sm';
    viewBtn.href = `/pages/wiki/wiki.html?tenant=${encodeURIComponent(tenant.slug)}`;
    viewBtn.textContent = 'View Specs';
    actions.appendChild(viewBtn);

    if (tenant.ownerUid === currentUid) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-icon';
      editBtn.type = 'button';
      editBtn.title = 'Edit tenant';
      editBtn.setAttribute('aria-label', 'Edit tenant');
      const editIcon = document.createElement('span');
      editIcon.className = 'icon';
      editIcon.setAttribute('aria-hidden', 'true');
      editIcon.textContent = 'edit';
      editBtn.appendChild(editIcon);
      editBtn.addEventListener('click', () => openEditForm(tenant));
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-icon btn-icon--danger';
      deleteBtn.type = 'button';
      deleteBtn.title = 'Delete tenant';
      deleteBtn.setAttribute('aria-label', 'Delete tenant');
      const deleteIcon = document.createElement('span');
      deleteIcon.className = 'icon';
      deleteIcon.setAttribute('aria-hidden', 'true');
      deleteIcon.textContent = 'delete';
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          `Delete tenant "${tenant.name}" (${tenant.slug})? This cannot be undone.`,
          { title: 'Delete tenant', confirmText: 'Delete', confirmStyle: 'danger' }
        );
        if (!confirmed) return;
        deleteBtn.disabled = true;
        try {
          await deleteTenant({ slug: tenant.slug });
          showToast(`Tenant "${tenant.name}" deleted.`, 'info');
          await refreshTenants();
        } catch (err) {
          setStatus(err.message || 'Failed to delete tenant.', 'error');
          deleteBtn.disabled = false;
        }
      });
      actions.appendChild(deleteBtn);
    }

    li.appendChild(actions);
    listEl.appendChild(li);
  }
}

let editingSlug = null;

function openEditForm(tenant) {
  editingSlug = tenant.slug;
  $('tenantsEditSlug').textContent = tenant.slug;
  $('editTenantNameInput').value = tenant.name || '';
  $('editTenantDescInput').value = tenant.description || '';
  $('editTenantRepoInput').value = tenant.githubRepo || '';
  const statusEl = $('tenantsEditStatus');
  statusEl.hidden = true;
  statusEl.textContent = '';
  $('tenantsEditSection').hidden = false;
  $('tenantsCreateSection').hidden = true;
  $('tenantsEditSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditForm() {
  editingSlug = null;
  $('tenantsEditSection').hidden = true;
  $('tenantsCreateSection').hidden = false;
}

async function handleEditSave(event) {
  event.preventDefault();
  if (!editingSlug) return;
  const name = $('editTenantNameInput').value.trim();
  const statusEl = $('tenantsEditStatus');
  statusEl.hidden = true;
  if (!name) {
    statusEl.textContent = 'Name is required.';
    statusEl.dataset.level = 'error';
    statusEl.hidden = false;
    return;
  }
  const saveBtn = $('tenantsEditSaveBtn');
  saveBtn.disabled = true;
  try {
    await updateTenant({
      slug: editingSlug,
      name,
      description: $('editTenantDescInput').value.trim(),
      githubRepo: $('editTenantRepoInput').value.trim() || null
    });
    closeEditForm();
    await refreshTenants();
  } catch (err) {
    statusEl.textContent = err.message || 'Failed to save.';
    statusEl.dataset.level = 'error';
    statusEl.hidden = false;
    saveBtn.disabled = false;
  }
}

async function refreshTenants() {
  const loadingEl = $('tenantsLoading');
  loadingEl.hidden = false;
  try {
    const { tenants } = await listTenants();
    renderTenants(tenants);
  } catch (err) {
    loadingEl.hidden = true;
    setStatus(`Failed to load tenants: ${err.message}`, 'error');
  }
}

async function handleCreate(event) {
  event.preventDefault();
  clearStatus();
  const slug = $('tenantSlugInput').value.trim().toLowerCase();
  const name = $('tenantNameInput').value.trim();
  const description = $('tenantDescInput').value.trim();
  const githubRepo = $('tenantRepoInput').value.trim() || null;

  if (!slug) {
    setStatus('Slug is required.', 'error');
    return;
  }
  if (!SLUG_PATTERN.test(slug)) {
    setStatus('Slug must be lowercase kebab-case (e.g. "my-app").', 'error');
    return;
  }
  if (slug.length < 2 || slug.length > 64) {
    setStatus('Slug must be between 2 and 64 characters.', 'error');
    return;
  }
  if (!name) {
    setStatus('Name is required.', 'error');
    return;
  }
  const submitBtn = $('tenantsCreateBtn');
  submitBtn.disabled = true;
  try {
    await createTenant({ slug, name, description, githubRepo });
    showToast(`Tenant "${name}" created.`, 'success');
    clearStatus();
    $('tenantsCreateForm').reset();
    await refreshTenants();
  } catch (err) {
    setStatus(err.message || 'Failed to create tenant', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function bind() {
  const createForm = $('tenantsCreateForm');
  if (createForm) createForm.addEventListener('submit', handleCreate);
  const editForm = $('tenantsEditForm');
  if (editForm) editForm.addEventListener('submit', handleEditSave);
  const cancelBtn = $('tenantsEditCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeEditForm);
  const refresh = $('tenantsRefreshBtn');
  if (refresh) refresh.addEventListener('click', refreshTenants);
}

async function init() {
  initializeSharedComponents('tenants');
  bind();
  try {
    await waitForFirebase();
  } catch {
    showSignedOutState();
    return;
  }
  const auth = getAuth();
  const apply = (user) => {
    if (!user) {
      currentUid = null;
      showSignedOutState();
      return;
    }
    currentUid = user.uid;
    showSignedInState();
    refreshTenants();
  };
  if (auth?.onAuthStateChanged) {
    auth.onAuthStateChanged(apply);
  } else {
    showSignedOutState();
  }
}

document.addEventListener('DOMContentLoaded', init);
