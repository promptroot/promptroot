import { slugify } from '../utils/slug.js';
import { STORAGE_KEYS, TAG_DEFINITIONS } from '../utils/constants.js';
import { debounce } from '../utils/debounce.js';
import { clearElement, createElement } from '../utils/dom-helpers.js';
import * as folderSubmenu from './folder-submenu.js';
import { loadFuse } from '../utils/lazy-loaders.js';
import { loadPrompts, getPromptFolder } from './prompt-service.js';

let files = [];
let expandedState = new Set();
let expandedStateKey = null;
let currentSlug = null;
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;
let listEl = null;
let searchEl = null;
let selectFileCallback = null;
let cachedFiles = null;
let cachedItemsWithTags = null;
let cachedFuseInstance = null;

const TAG_REGEXES = Object.fromEntries(
  Object.entries(TAG_DEFINITIONS).map(([key, tag]) => [
    key,
    tag.keywords.map(kw => new RegExp(kw, 'i'))
  ])
);

export function setSelectFileCallback(callback) {
  selectFileCallback = callback;
}

export function setRepoContext(owner, repo, branch) {
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;
  folderSubmenu.setContext(owner, repo, branch);
}

export function initPromptList() {
  listEl = document.getElementById('list');
  searchEl = document.getElementById('search');
  const searchClearBtn = document.getElementById('searchClear');

  const debouncedRender = debounce(async () => {
    await renderList(files, currentOwner, currentRepo, currentBranch);
  }, 300);
  
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      // Immediate UI updates
      if (searchClearBtn) {
        if (searchEl.value) {
          searchClearBtn.classList.remove('hidden');
        } else {
          searchClearBtn.classList.add('hidden');
        }
      }
      // Debounced search
      debouncedRender();
    });
  }
  
  if (searchClearBtn && searchEl) {
    searchClearBtn.addEventListener('click', async () => {
      searchEl.value = '';
      searchClearBtn.classList.add('hidden');
      searchEl.focus();
      await renderList(files, currentOwner, currentRepo, currentBranch);
    });
  }
  folderSubmenu.init();
  if (listEl) {
    listEl.addEventListener('click', handleListClick);
    listEl.addEventListener('keydown', handleListKeydown);
  }

  const sidebarHeader = document.getElementById('sidebarHeader');
  if (sidebarHeader) {
    sidebarHeader.addEventListener('click', handleHeaderClick);
    sidebarHeader.addEventListener('keydown', handleListKeydown);
  }
}

export function destroyPromptList() {
  folderSubmenu.destroy();
  files = [];
  expandedState.clear();
  expandedStateKey = null;
  currentSlug = null;
  currentOwner = null;
  currentRepo = null;
  currentBranch = null;
  selectFileCallback = null;
  cachedFiles = null;
  cachedItemsWithTags = null;
  cachedFuseInstance = null;
}

export function getFiles() {
  return files;
}

export function getCurrentSlug() {
  return currentSlug;
}

export function setCurrentSlug(slug) {
  currentSlug = slug;
}

export function ensureAncestorsExpanded(path) {
  const ancestors = ancestorPaths(path);
  let changed = false;
  for (const dir of ancestors) {
    if (!expandedState.has(dir)) {
      expandedState.add(dir);
      changed = true;
    }
  }
  if (changed) persistExpandedState();
  return changed;
}

function getCleanTitle(name) {
  return name.replace(/\.md$/i, "");
}

function getExpandedStateKey(owner, repo, branch) {
  return STORAGE_KEYS.expandedState(owner, repo, branch);
}

export function loadExpandedState(owner, repo, branch) {
  const key = getExpandedStateKey(owner, repo, branch);
  if (expandedStateKey === key) return;
  expandedStateKey = key;
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    expandedState = new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error('Error loading expanded state:', {
      error,
      context: 'loadExpandedState',
      owner, repo, branch
    });
    expandedState = new Set();
  }
  expandedState.add('prompts');
}

export function persistExpandedState() {
  const key = expandedStateKey;
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...expandedState]));
  } catch (error) {
    console.error('Error persisting expanded state:', {
      error,
      context: 'persistExpandedState',
      key
    });
  }
}

export async function toggleDirectory(path, expand) {
  const before = expandedState.has(path);
  if (expand) {
    expandedState.add(path);
  } else {
    expandedState.delete(path);
  }
  if (before !== expand) {
    persistExpandedState();
  }
  await renderList(files, currentOwner, currentRepo, currentBranch);
}

function handleListKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    const target = event.target;
    // Check if it's one of our custom buttons
    if (target.matches('[role="button"]') || target.closest('[role="button"]')) {
      event.preventDefault();
      event.stopPropagation();
      target.click();
    }
  }
}

function handleListClick(event) {
  const target = event.target;
  const badge = target.closest('.tag-badge');
  if (badge && searchEl) {
    event.preventDefault();
    event.stopPropagation();
    const tagKey = badge.dataset.tag;
    const label = TAG_DEFINITIONS[tagKey]?.label || tagKey;
    if (label) {
      searchEl.value = label;
      searchEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  const toggleBtn = target.closest('[data-action="toggle-dir"]');
  if (toggleBtn) {
    event.stopPropagation();
    const path = toggleBtn.dataset.path;
    const isExpanded = expandedState.has(path);
    toggleDirectory(path, !isExpanded);
    return;
  }
  const treeDir = target.closest('.tree-dir');
  if (treeDir && !target.closest('.folder-icons')) {
    event.stopPropagation();
    const path = treeDir.dataset.path;
    if (path) {
      const isExpanded = expandedState.has(path);
      toggleDirectory(path, !isExpanded);
    }
    return;
  }
  const ghIcon = target.closest('[data-action="open-github"]');
  if (ghIcon) {
    event.stopPropagation();
    const path = ghIcon.dataset.path;
    const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/tree/${currentBranch}/${path}`;
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const addIcon = target.closest('[data-action="show-submenu"]');
  if (addIcon) {
    event.stopPropagation();
    const path = addIcon.dataset.path;
    folderSubmenu.toggle(addIcon, path);
    return;
  }
  const fileLink = target.closest('.item');
  if (fileLink) {
    event.preventDefault();
    const filePath = fileLink.dataset.path;
    
    if (selectFileCallback && filePath) {
      const file = files.find(f => f.path === filePath);
      if (file) {
        selectFileCallback(file, true, currentOwner, currentRepo, currentBranch).catch(err => {
          console.error('Error selecting file:', err);
        });
      }
    }
    return;
  }
}

function ancestorPaths(path) {
  const parts = path.split('/');
  const ancestors = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join('/'));
  }
  return ancestors;
}

function buildTree(items, folder = 'prompts') {
  const root = { type: 'dir', name: folder, path: folder, children: new Map() };
  for (const item of items) {
    if (!item.path) continue;
    const relative = item.path.replace(new RegExp(`^${folder}/?`), '');
    const segments = relative.split('/');
    let node = root;
    let currentPath = folder;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isFile = i === segments.length - 1;
      if (isFile) {
        node.children.set(segment, { ...item, type: 'file' });
      } else {
        currentPath = `${currentPath}/${segment}`;
        if (!node.children.has(segment)) {
          node.children.set(segment, {
            type: 'dir',
            name: segment,
            path: currentPath,
            children: new Map()
          });
        }
        node = node.children.get(segment);
      }
    }
  }
  return root;
}

function renderTree(node, container, options) {
  const { forcedExpanded } = options;
  const entries = Array.from(node.children.values());
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    return aName.localeCompare(bName);
  });

  for (const entry of entries) {
    if (entry.type === 'dir') {
      const li = document.createElement('li');
      const header = document.createElement('div');
      header.className = 'tree-dir';
      header.dataset.path = entry.path;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      const isForced = forcedExpanded.has(entry.path);
      const isExpanded = isForced || expandedState.has(entry.path);
      toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`);

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = isExpanded ? 'expand_more' : 'chevron_right';
      toggle.appendChild(icon);

      toggle.dataset.action = 'toggle-dir';
      toggle.dataset.path = entry.path;

      const label = document.createElement('span');
      label.className = 'folder-name';
      label.textContent = entry.name;

      const iconsContainer = document.createElement('div');
      iconsContainer.className = 'folder-icons';

      const ghIcon = document.createElement('span');
      ghIcon.className = 'github-folder-icon icon icon-inline';
      ghIcon.textContent = 'folder';
      ghIcon.setAttribute('role', 'button');
      ghIcon.setAttribute('tabindex', '0');
      ghIcon.setAttribute('aria-label', 'Open directory on GitHub');
      ghIcon.title = 'Open directory on GitHub';
      ghIcon.dataset.action = 'open-github';
      ghIcon.dataset.path = entry.path;

      const addIcon = document.createElement('span');
      addIcon.className = 'add-file-icon icon icon-inline';
      addIcon.textContent = 'add';
      addIcon.setAttribute('role', 'button');
      addIcon.setAttribute('tabindex', '0');
      addIcon.setAttribute('aria-label', 'Create new file in this directory');
      addIcon.setAttribute('aria-haspopup', 'true');
      addIcon.setAttribute('aria-expanded', 'false');
      addIcon.title = 'Create new file in this directory';
      addIcon.dataset.action = 'show-submenu';
      addIcon.dataset.path = entry.path;

      iconsContainer.appendChild(ghIcon);
      iconsContainer.appendChild(addIcon);

      header.appendChild(toggle);
      header.appendChild(label);
      header.appendChild(iconsContainer);
      li.appendChild(header);

      const childList = document.createElement('ul');
      if (isExpanded) {
        childList.classList.remove('d-none');
      } else {
        childList.classList.add('d-none');
      }
      li.appendChild(childList);
      renderTree(entry, childList, options);
      if (!childList.children.length) {
        continue;
      }
      container.appendChild(li);
    } else {
      const file = entry;
      const li = document.createElement('li');
      const slug = slugify(file.path);
      const a = document.createElement('a');
      a.className = 'item';
      a.href = `#p=${encodeURIComponent(slug)}`;
      a.dataset.slug = slug;
      a.dataset.path = file.path;

      const left = document.createElement('div');
      left.classList.add('flex-1', 'min-w-0', 'd-flex', 'flex-col', 'flex-gap-xs');
      const t = document.createElement('div');
      t.className = 'item-title text-truncate';
      t.textContent = getCleanTitle(file.name);
      left.appendChild(t);

      const tagContainer = document.createElement('div');
      tagContainer.className = 'tag-container';
      const addedTags = new Set();

      for (const [key, tag] of Object.entries(TAG_DEFINITIONS)) {
        const regexes = TAG_REGEXES[key];
        if (regexes.some(re => re.test(file.name))) {
          if (addedTags.has(key)) continue;

          const badge = document.createElement('span');
          badge.className = `tag-badge ${tag.className}`;
          badge.textContent = tag.label;
          badge.dataset.tag = key;

          tagContainer.appendChild(badge);
          addedTags.add(key);
        }
      }

      if (tagContainer.children.length > 0) {
        left.appendChild(tagContainer);
      }

      a.appendChild(left);
      li.appendChild(a);
      container.appendChild(li);
    }
  }
}

export function updateActiveItem() {
  const anchors = listEl.querySelectorAll('.item');
  anchors.forEach((a) => {
    if (a.dataset.slug === currentSlug) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

function createStatusMessage(message) {
  const container = createElement('div', 'color-muted pad-8');
  if (typeof message === 'string') {
    container.textContent = message;
  } else if (message instanceof Node) {
    container.appendChild(message);
  }
  return container;
}

export async function renderList(items, owner, repo, branch) {
  if (!Array.isArray(items)) {
    console.warn('renderList received non-array items:', items);
    items = [];
  }
  
  loadExpandedState(owner, repo, branch);
  const q = searchEl && searchEl.value ? searchEl.value.trim() : '';
  const searchActive = Boolean(q);

  // Ensure items is an array
  if (!Array.isArray(items)) {
    console.error('renderList received non-array items:', items);
    items = [];
  }

  let filtered = [];
  if (!q) {
    filtered = items.slice();
  } else {
    // Rebuild cache if items changed
    if (cachedFiles !== items) {
      cachedFiles = items;
      cachedItemsWithTags = items.map(item => {
        const tags = [];
        for (const tagKey in TAG_DEFINITIONS) {
          const tag = TAG_DEFINITIONS[tagKey];
          const regexes = TAG_REGEXES[tagKey];
          if (regexes.some(re => re.test(item.name))) {
            tags.push(tag.label);
          }
        }
        return { ...item, tags };
      });
      cachedFuseInstance = null; // Clear old instance
    }
    
    // Lazy load Fuse only when actually searching
    if (!cachedFuseInstance) {
      const Fuse = await loadFuse();
      cachedFuseInstance = new Fuse(cachedItemsWithTags, {
        keys: ['name', 'path', 'tags'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    
    filtered = cachedFuseInstance.search(q).map(result => result.item);
  }

  if (!filtered.length) {
    clearElement(listEl);
    listEl.appendChild(createStatusMessage('No prompts found.'));
    return;
  }

  const forcedExpanded = new Set();
  if (searchActive) {
    for (const file of filtered) {
      for (const ancestor of ancestorPaths(file.path)) {
        forcedExpanded.add(ancestor);
      }
    }
  }

  clearElement(listEl);
  const rootList = document.createElement('ul');
  listEl.appendChild(rootList);
  const folder = getPromptFolder(branch);
  const tree = buildTree(filtered, folder);
  renderTree(tree, rootList, { forcedExpanded });
  updateActiveItem();
}

export async function loadList(owner, repo, branch, cacheKey) {
  try {
    const onBackgroundUpdate = async (updatedFiles) => {
      files = updatedFiles;
      await renderList(files, owner, repo, branch);
    };

    files = await loadPrompts(owner, repo, branch, cacheKey, onBackgroundUpdate);
    await renderList(files, owner, repo, branch);
    return files;
  } catch (e) {
    const folder = getPromptFolder(branch);
    clearElement(listEl);

    const msgContainer = document.createElement('div');
    msgContainer.appendChild(document.createTextNode('Could not load prompts from '));
    const code = createElement('code', '', `${owner}/${repo}@${branch}/${folder}`);
    msgContainer.appendChild(code);
    msgContainer.appendChild(document.createElement('br'));
    msgContainer.appendChild(document.createTextNode(e.message));

    listEl.appendChild(createStatusMessage(msgContainer));
    return [];
  }
}

function handleHeaderClick(event) {
  const target = event.target;

  const addIconRoot = target.closest('[data-action="show-submenu-root"]');
  if (addIconRoot) {
    event.stopPropagation();
    folderSubmenu.toggle(addIconRoot, getPromptFolder(currentBranch));
    return;
  }

  const ghIconRoot = target.closest('[data-action="open-github-root"]');
  if (ghIconRoot) {
    event.stopPropagation();
    const folder = getPromptFolder(currentBranch);
    const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/tree/${currentBranch}/${folder}`;
    window.open(ghUrl, '_blank', 'noopener,noreferrer');
    return;
  }
}
