import { FOLDER_SUBMENU_TEXT } from '../utils/constants.js';
import { ICONS, createIcon } from '../utils/icon-helpers.js';

let submenuEl = null;
let activeSubmenuHeaders = new Set();
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;
let currentTrigger = null;
let keydownListener = null;

export function setContext(owner, repo, branch) {
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;
}

export function init() {
  createSubmenu();
  document.addEventListener('click', handleDocumentClick);
  
  // Listen for Escape key to close submenus
  keydownListener = (e) => {
    if (e.key === 'Escape' && submenuEl?.classList.contains('folder-submenu--visible')) {
      closeAll();
    }
  };
  document.addEventListener('keydown', keydownListener);
  
  // Listen for branch changes from the header branch selector
  window.addEventListener('branchChanged', (event) => {
    if (event.detail && event.detail.branch) {
      currentBranch = event.detail.branch;
    }
  });
}

export function destroy() {
  document.removeEventListener('click', handleDocumentClick);
  if (keydownListener) {
    document.removeEventListener('keydown', keydownListener);
    keydownListener = null;
  }
  if (submenuEl && submenuEl.parentNode) {
    submenuEl.parentNode.removeChild(submenuEl);
  }
  submenuEl = null;
  activeSubmenuHeaders.clear();
  currentOwner = null;
  currentRepo = null;
  currentBranch = null;
  currentTrigger = null;
}

export function toggle(triggerElement, path) {
  if (!submenuEl) return;

  const header = triggerElement.closest('.tree-dir');
  const wasVisible = submenuEl.classList.contains('folder-submenu--visible');
  const isSamePath = submenuEl.dataset.currentPath === path;

  closeAll();

  // If it was visible and we clicked the same icon, we just closed it (toggle behavior).
  // If it was visible but different icon, or not visible, we open the new one.
  if (wasVisible && isSamePath) {
    return;
  }

  open(triggerElement, path, header);
}

function open(triggerElement, path, header) {
  const rect = triggerElement.getBoundingClientRect();
  submenuEl.dataset.currentPath = path;
  
  // Use positioning class for measurement without visibility
  submenuEl.classList.add('folder-submenu--positioning');

  const submenuRect = submenuEl.getBoundingClientRect();

  let left = rect.right;
  let top = rect.top;

  if (left + submenuRect.width > window.innerWidth - 10) {
    left = rect.left - submenuRect.width;
  }

  if (top + submenuRect.height > window.innerHeight - 10) {
    top = rect.bottom - submenuRect.height;
  }

  if (left < 10) left = 10;
  if (top < 10) top = 10;

  submenuEl.style.setProperty('--submenu-left', `${left}px`);
  submenuEl.style.setProperty('--submenu-top', `${top}px`);
  
  // Replace positioning class with visible class
  submenuEl.classList.remove('folder-submenu--positioning');
  submenuEl.classList.add('folder-submenu--visible');
  
  // Track trigger and update ARIA
  currentTrigger = triggerElement;
  currentTrigger.setAttribute('aria-expanded', 'true');

  if (header) {
    header.classList.add('submenu-open');
    activeSubmenuHeaders.add(header);
  }
}

function closeAll() {
  if (submenuEl) {
    submenuEl.classList.remove('folder-submenu--visible');
    submenuEl.classList.remove('folder-submenu--positioning');
  }
  if (currentTrigger) {
    currentTrigger.setAttribute('aria-expanded', 'false');
    currentTrigger = null;
  }
  activeSubmenuHeaders.forEach(header => {
    header.classList.remove('submenu-open');
  });
  activeSubmenuHeaders.clear();
}

function createSubmenu() {
  if (submenuEl) return;

  submenuEl = document.createElement('div');
  submenuEl.className = 'folder-submenu';
  submenuEl.setAttribute('role', 'menu');

  const makeMenuItem = (label, emoji, dataAction) => {
    const item = document.createElement('div');
    item.className = 'folder-submenu-item';
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '-1');
    item.innerHTML = `${emoji} ${label}`;
    item.dataset.action = dataAction;
    return item;
  };

  submenuEl.appendChild(makeMenuItem(FOLDER_SUBMENU_TEXT.NEW_PROMPT, createIcon(ICONS.FREE_INPUT, { size: 'inline' }), FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT));
  submenuEl.appendChild(makeMenuItem(FOLDER_SUBMENU_TEXT.NEW_CONVERSATION, createIcon(ICONS.CHAT, { size: 'inline' }), FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_CONVERSATION));

  document.body.appendChild(submenuEl);
}

function handleDocumentClick(event) {
  const target = event.target;
  const submenuItem = target.closest('.folder-submenu-item');

  if (submenuItem && submenuEl) {
    event.stopPropagation();
    const action = submenuItem.dataset.action;
    const path = submenuEl.dataset.currentPath;

    closeAll();

    if (action === FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT) {
      const now = new Date();
      const timestamp = `${now.getFullYear().toString().slice(-2)}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
      const newFilePath = path ? `${path}/${FOLDER_SUBMENU_TEXT.NEW_PROMPT_FILENAME_PREFIX}${timestamp}.md` : `${FOLDER_SUBMENU_TEXT.NEW_PROMPT_FILENAME_PREFIX}${timestamp}.md`;
      const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/new/${currentBranch}?filename=${encodeURIComponent(newFilePath)}&ref=${encodeURIComponent(currentBranch)}`;
      window.open(ghUrl, '_blank', 'noopener,noreferrer');
    } else if (action === FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_CONVERSATION) {
      const template = FOLDER_SUBMENU_TEXT.CONVERSATION_TEMPLATE;
      const encoded = encodeURIComponent(template);
      const newFilePath = path ? `${path}/${FOLDER_SUBMENU_TEXT.NEW_CONVERSATION_FILENAME}` : FOLDER_SUBMENU_TEXT.NEW_CONVERSATION_FILENAME;
      const ghUrl = `https://github.com/${currentOwner}/${currentRepo}/new/${currentBranch}?filename=${encodeURIComponent(newFilePath)}&value=${encoded}&ref=${encodeURIComponent(currentBranch)}`;
      window.open(ghUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  // If clicking outside, close.
  // Note: Clicks on the toggle button itself are handled in prompt-list.js (or whoever calls toggle),
  // but since prompt-list.js calls toggle() which handles logic, we just need to make sure we don't double close/open?
  // Wait, if I click the toggle button:
  // 1. prompt-list.js 'click' handler fires. It calls toggle().
  // 2. toggle() toggles the menu.
  // 3. Document 'click' handler fires (bubbling). It calls closeAll().
  // Result: Menu opens then immediately closes.
  // Fix: prompt-list.js calls event.stopPropagation().

  closeAll();
}
