import { initializeSharedComponents } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listTenants, createTenant, updateTenant, deleteTenant } from '../modules/wiki-api.js';

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
    meta.appendChild(document.createTextNode(' '));

    const vis = document.createElement('span');
    vis.className = `tenants-pill tenants-pill--${tenant.visibility}`;
    vis.textContent = tenant.visibility;
    meta.appendChild(vis);

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
    viewBtn.textContent = 'View SDDs';
    actions.appendChild(viewBtn);

    if (tenant.ownerUid === currentUid) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn sm';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn sm danger';
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      // Inline edit panel
      const editPanel = document.createElement('div');
      editPanel.className = 'tenants-edit-panel';
      editPanel.hidden = true;

      const mkField = (labelText, id, value, type = 'text') => {
        const row = document.createElement('div');
        row.className = 'form-row';
        const label = document.createElement('label');
        label.className = 'form-label';
        label.htmlFor = id;
        label.textContent = labelText;
        const input = document.createElement('input');
        input.id = id;
        input.className = 'form-control';
        input.type = type;
        input.value = value || '';
        row.appendChild(label);
        row.appendChild(input);
        return { row, input };
      };

      const { row: nameRow, input: nameInput } = mkField('Name', `edit-name-${tenant.slug}`, tenant.name);
      const { row: descRow, input: descInput } = mkField('Description', `edit-desc-${tenant.slug}`, tenant.description);
      const { row: repoRow, input: repoInput } = mkField('GitHub repo', `edit-repo-${tenant.slug}`, tenant.githubRepo);

      const visRow = document.createElement('div');
      visRow.className = 'form-row';
      const visLabel = document.createElement('label');
      visLabel.className = 'form-label';
      visLabel.htmlFor = `edit-vis-${tenant.slug}`;
      visLabel.textContent = 'Visibility';
      const visSelect = document.createElement('select');
      visSelect.id = `edit-vis-${tenant.slug}`;
      visSelect.className = 'form-control';
      for (const [val, text] of [['private', 'Private (members only)'], ['public', 'Public (anyone can read)']]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        if (val === tenant.visibility) opt.selected = true;
        visSelect.appendChild(opt);
      }
      visRow.appendChild(visLabel);
      visRow.appendChild(visSelect);

      const editActions = document.createElement('div');
      editActions.className = 'tenants-edit-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn primary sm';
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn sm';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';

      const editStatus = document.createElement('div');
      editStatus.className = 'tenants-status';
      editStatus.setAttribute('role', 'status');
      editStatus.setAttribute('aria-live', 'polite');
      editStatus.hidden = true;

      editActions.appendChild(saveBtn);
      editActions.appendChild(cancelBtn);
      editPanel.appendChild(nameRow);
      editPanel.appendChild(descRow);
      editPanel.appendChild(visRow);
      editPanel.appendChild(repoRow);
      editPanel.appendChild(editActions);
      editPanel.appendChild(editStatus);

      editBtn.addEventListener('click', () => {
        editPanel.hidden = !editPanel.hidden;
        editStatus.hidden = true;
      });

      cancelBtn.addEventListener('click', () => { editPanel.hidden = true; });

      saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
          editStatus.textContent = 'Name is required.';
          editStatus.dataset.level = 'error';
          editStatus.hidden = false;
          return;
        }
        saveBtn.disabled = true;
        try {
          await updateTenant({
            slug: tenant.slug,
            name,
            description: descInput.value.trim(),
            visibility: visSelect.value,
            githubRepo: repoInput.value.trim() || null
          });
          editPanel.hidden = true;
          await refreshTenants();
        } catch (err) {
          editStatus.textContent = err.message || 'Failed to save.';
          editStatus.dataset.level = 'error';
          editStatus.hidden = false;
          saveBtn.disabled = false;
        }
      });

      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete tenant "${tenant.name}" (${tenant.slug})? This cannot be undone.`)) return;
        deleteBtn.disabled = true;
        try {
          await deleteTenant({ slug: tenant.slug });
          await refreshTenants();
        } catch (err) {
          setStatus(err.message || 'Failed to delete tenant.', 'error');
          deleteBtn.disabled = false;
        }
      });

      li.appendChild(editPanel);
    }

    li.appendChild(actions);
    listEl.appendChild(li);
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
  const visibility = $('tenantVisibilitySelect').value;
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
    await createTenant({ slug, name, description, visibility, githubRepo });
    setStatus(`Tenant ${slug} created.`, 'success');
    $('tenantsCreateForm').reset();
    $('tenantVisibilitySelect').value = 'private';
    await refreshTenants();
  } catch (err) {
    setStatus(err.message || 'Failed to create tenant', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function bind() {
  const form = $('tenantsCreateForm');
  if (form) form.addEventListener('submit', handleCreate);
  const refresh = $('tenantsRefreshBtn');
  if (refresh) refresh.addEventListener('click', refreshTenants);
}

async function init() {
  initializeSharedComponents('tenants');
  bind();
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
  if (auth?.currentUser) {
    apply(auth.currentUser);
  }
  if (auth?.onAuthStateChanged) {
    auth.onAuthStateChanged(apply);
  } else {
    showSignedOutState();
  }
}

document.addEventListener('DOMContentLoaded', init);
