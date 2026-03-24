import { slugify } from '../utils/slug.js';
import { isGistUrl, resolveGistRawUrl, fetchGistContent, fetchRawFile } from './github-api.js';
import { CODEX_URL_REGEX, TIMEOUTS } from '../utils/constants.js';
import { toggleVisibility } from '../utils/dom-helpers.js';
import { loadMarked } from '../utils/lazy-loaders.js';
import { ensureAncestorsExpanded, loadExpandedState, persistExpandedState, renderList, updateActiveItem, setCurrentSlug, getCurrentSlug, getFiles } from './prompt-list.js';
import { showToast } from './toast.js';
import { copyAndOpen, clearCopenCache } from './copen.js';
import { copyText } from '../utils/clipboard.js';
import statusBar from './status-bar.js';
import { initSplitButton, destroySplitButton, updateSplitButtonOptions } from './split-button.js';
import { getCopenOptions, COPEN_STORAGE_KEY, COPEN_DEFAULT_LABEL, COPEN_DEFAULT_ICON } from '../utils/copen-config.js';
import { getAuth } from './firebase-service.js';

let domPurifyHooksInitialized = false;

export function sanitizeHtml(html) {
  if (typeof window.DOMPurify === 'undefined') {
    console.error('DOMPurify not loaded - stripping all HTML tags as safety fallback');
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  if (!domPurifyHooksInitialized) {
    window.DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
      }

      if (node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    domPurifyHooksInitialized = true;
  }

  const config = {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'del', 'ins', 'sub', 'sup',
      'code', 'pre',
      'blockquote',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'div', 'span'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel',
      'colspan', 'rowspan', 'align'
    ],
    // Only allow data:image/ URIs to prevent XSS via data:text/html or other executable types
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|data:image\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'base', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  };

  return window.DOMPurify.sanitize(html, config);
}

let cacheRaw = new Map();
let currentPromptText = null;
let currentFile = null;
let currentOwner = null;
let currentRepo = null;
let currentBranch = null;
let handleTryInJulesCallback = null;
let currentBlobUrl = null;

export function setHandleTryInJulesCallback(callback) {
  handleTryInJulesCallback = callback;
}

let contentEl = null;
let titleEl = null;
let metaEl = null;
let emptyEl = null;
let actionsEl = null;
let copyBtn = null;
let customizeBtn = null;
let copenContainer = null;
let copenSplitBtn = null;
let rawBtn = null;
let ghBtn = null;
let editBtn = null;
let shareBtn = null;
let runInAgentContainer = null;
let runInAgentSplitBtn = null;
let freeInputBtn = null;
let queueBtn = null;
let scheduleBtn = null;
let moreBtn = null;

export function initPromptRenderer() {
  contentEl = document.getElementById('content');
  titleEl = document.getElementById('title');
  metaEl = document.getElementById('meta');
  emptyEl = document.getElementById('empty');
  actionsEl = document.getElementById('actions');
  copyBtn = document.getElementById('copyBtn');
  customizeBtn = document.getElementById('customizeBtn');
  
  copenContainer = document.getElementById('copenContainer');
  if (copenContainer) {
    // Initialize with static options, will be updated when user auth changes
    copenSplitBtn = initSplitButton({
      container: copenContainer,
      defaultLabel: COPEN_DEFAULT_LABEL,
      defaultIcon: COPEN_DEFAULT_ICON,
      options: [],
      onAction: handleCopenPrompt,
      storageKey: COPEN_STORAGE_KEY
    });
    
    // Load user's copen options
    refreshCopenOptions();
  }
  
  // Listen for auth state changes to refresh copen options
  const auth = getAuth();
  if (auth) {
    auth.onAuthStateChanged(() => {
      clearCopenCache();
      refreshCopenOptions();
    });
  }
  
  // Listen for copen changes
  window.addEventListener('copensChanged', () => {
    clearCopenCache();
    refreshCopenOptions();
  });
  
  rawBtn = document.getElementById('rawBtn');
  ghBtn = document.getElementById('ghBtn');
  editBtn = document.getElementById('editBtn');
  shareBtn = document.getElementById('shareBtn');
  runInAgentContainer = document.getElementById('runInAgentContainer');
  if (runInAgentContainer) {
    _initRunInAgentButton();
  }
  freeInputBtn = document.getElementById('freeInputBtn');
  queueBtn = document.getElementById('queueBtn');
  scheduleBtn = document.getElementById('scheduleBtn');
  moreBtn = document.getElementById('moreBtn');

  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('branchChanged', handleBranchChanged);
}

async function _initRunInAgentButton() {
  const { getAgentOptions, getLastAgent, saveLastAgent, isBraceConfigured } = await import('./run-in-agent.js');

  const auth = getAuth();
  const user = auth?.currentUser;

  let braceEnabled = false;
  if (user) {
    try { braceEnabled = await isBraceConfigured(user.uid); } catch {}
  }

  const options = getAgentOptions(braceEnabled);
  const lastAgent = getLastAgent();

  runInAgentSplitBtn = initSplitButton({
    container: runInAgentContainer,
    defaultLabel: 'Run in Agent',
    defaultIcon: 'smart_toy',
    options,
    onAction: async (selectedAgent) => {
      saveLastAgent(selectedAgent);
      if (selectedAgent === 'jules') {
        // Use the higher-level callback (not dispatchToAgent) because it handles the Jules
        // modal flow, key checks, and other UI machinery that dispatchToAgent bypasses.
        if (handleTryInJulesCallback) {
          handleTryInJulesCallback(currentPromptText);
        }
      } else if (selectedAgent === 'brace') {
        try {
          const { dispatchToAgent } = await import('./run-in-agent.js');
          await dispatchToAgent('brace', { promptText: currentPromptText, title: '' });
          showToast('Sent to Brace!', 'success');
        } catch (err) {
          showToast('Failed to send to Brace: ' + err.message, 'error');
        }
      }
    }
  });

  // Set initial selection to last used agent
  if (runInAgentSplitBtn && lastAgent !== 'jules') {
    runInAgentSplitBtn.setSelection(lastAgent);
  }

  // Refresh on auth state change
  if (auth) {
    auth.onAuthStateChanged(async (u) => {
      if (!runInAgentContainer || !runInAgentSplitBtn) return;
      let enabled = false;
      if (u) { try { enabled = await isBraceConfigured(u.uid); } catch {} }
      runInAgentSplitBtn.updateOptions(getAgentOptions(enabled));
    });
  }
}

async function refreshCopenOptions() {
  if (!copenContainer || !copenSplitBtn) return;
  
  try {
    const options = await getCopenOptions();
    updateSplitButtonOptions(copenContainer, options);
  } catch (error) {
    console.error('Error refreshing copen options:', error);
  }
}

export function destroyPromptRenderer() {
  document.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('branchChanged', handleBranchChanged);
  window.removeEventListener('copensChanged', refreshCopenOptions);
  
  if (copenContainer) {
    destroySplitButton(copenContainer);
    copenSplitBtn = null;
  }

  if (runInAgentContainer) {
    destroySplitButton(runInAgentContainer);
    runInAgentSplitBtn = null;
  }
  
  cacheRaw.clear();
  currentPromptText = null;
  handleTryInJulesCallback = null;
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
}

function handleDocumentClick(event) {
  const target = event.target;
  const moreMenu = document.getElementById('moreMenu');

  if (target === copyBtn) {
    handleCopyPrompt();
    return;
  }

  if (target === customizeBtn) {
    (async () => {
      const { showCustomizeModal } = await import('./variable-substitution.js');
      showCustomizeModal(currentPromptText);
    })();
    return;
  }

  if (target === shareBtn) {
    handleShareLink();
    return;
  }

  if (target === freeInputBtn) {
    (async () => {
      const { showFreeInputModal } = await import('./jules-free-input.js');
      showFreeInputModal();
    })();
    return;
  }

  if (target === queueBtn) {
    if (!currentFile || !currentPromptText || !currentOwner || !currentRepo || !currentBranch) {
      showToast('No prompt selected to add to queue', 'warn');
      return;
    }
    
    (async () => {
      try {
        const { handleQueueAction } = await import('./jules-queue.js');
        const { extractTitleFromPrompt } = await import('../utils/title.js');
        
        const title = extractTitleFromPrompt(currentPromptText) || currentFile.name.replace(/\.md$/i, '');
        const sourceId = `${currentOwner}/${currentRepo}`;
        
        await handleQueueAction({
          type: 'single',
          prompt: currentPromptText,
          sourceId: sourceId,
          branch: currentBranch,
          note: `Queued from prompt: ${currentFile.path}`,
          title: title,
          filePath: currentFile.path
        });
      } catch (err) {
        console.error('Failed to add prompt to queue:', err);
        showToast('Failed to add prompt to queue', 'error');
      }
    })();
    return;
  }

  if (target === scheduleBtn) {
    if (!currentFile || !currentPromptText || !currentOwner || !currentRepo || !currentBranch) {
      showToast('No prompt selected to schedule', 'warn');
      return;
    }
    
    (async () => {
      try {
        const { showJulesEnvModal } = await import('./jules-modal.js');
        // Show repo/branch selection modal in schedule mode
        await showJulesEnvModal(currentPromptText, 'schedule');
      } catch (err) {
        console.error('Failed to show schedule modal:', err);
        showToast('Failed to show schedule options', 'error');
      }
    })();
    return;
  }

  if (target === moreBtn) {
    event.stopPropagation();
    if (moreMenu) {
      moreMenu.classList.toggle('hidden');
    }
    return;
  }

  const moreEditBtn = document.getElementById('moreEditBtn');
  const moreGhBtn = document.getElementById('moreGhBtn');
  const moreRawBtn = document.getElementById('moreRawBtn');

  if (target === moreEditBtn) {
    event.stopPropagation();
    if (editBtn && editBtn.href) {
      window.open(editBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.classList.add('hidden');
    return;
  }

  if (target === moreGhBtn) {
    event.stopPropagation();
    if (ghBtn && ghBtn.href) {
      window.open(ghBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.classList.add('hidden');
    return;
  }

  if (target === moreRawBtn) {
    event.stopPropagation();
    if (rawBtn && rawBtn.href) {
      window.open(rawBtn.href, '_blank', 'noopener,noreferrer');
    }
    if (moreMenu) moreMenu.classList.add('hidden');
    return;
  }

  if (moreMenu) moreMenu.classList.add('hidden');
}

async function handleBranchChanged() {
  toggleVisibility(titleEl, false);
  toggleVisibility(metaEl, false);
  toggleVisibility(actionsEl, false);
  toggleVisibility(emptyEl, false);
  if (contentEl) contentEl.innerHTML = '';
  setCurrentSlug(null);
  currentPromptText = null;
  updateActiveItem();
  const { showFreeInputForm } = await import('./jules-free-input.js');
  showFreeInputForm();
}

export function getCurrentPromptText() {
  return currentPromptText;
}

export function setCurrentPromptText(text) {
  currentPromptText = text;
}

export async function selectBySlug(slug, files, owner, repo, branch) {
  try {
    const f = files.find(x => slugify(x.path) === slug);
    if (f) {
      await selectFile(f, false, owner, repo, branch);
    } else {
      const { showFreeInputForm } = await import('./jules-free-input.js');
      showFreeInputForm();
    }
  } catch (error) {
    console.error('Error selecting file by slug:', error);
  }
}

export async function selectFile(f, pushHash, owner, repo, branch) {
  if (!f) {
    if (editBtn) {
      toggleVisibility(editBtn, false);
      editBtn.removeAttribute('href');
    }
    currentFile = null;
    currentOwner = null;
    currentRepo = null;
    currentBranch = null;
    return;
  }

  // Store current context
  currentFile = f;
  currentOwner = owner;
  currentRepo = repo;
  currentBranch = branch;

  const freeInputSection = document.getElementById('freeInputSection');
  if (freeInputSection) {
    freeInputSection.classList.add('hidden');
  }

  toggleVisibility(emptyEl, false);
  toggleVisibility(titleEl, true);
  toggleVisibility(metaEl, true);
  toggleVisibility(actionsEl, true);
  
  // Ensure visibility (replaces previous inline style clearing)
  if (titleEl) toggleVisibility(titleEl, true);
  if (metaEl) toggleVisibility(metaEl, true);
  if (actionsEl) toggleVisibility(actionsEl, true);
  
  if (contentEl) {
    toggleVisibility(contentEl, true);
  }

  titleEl.textContent = f.name.replace(/\.md$/i, '');
  metaEl.textContent = `File: ${f.path}`;

  const slug = slugify(f.path);
  if (pushHash) history.pushState(null, '', `#p=${encodeURIComponent(slug)}`);
  setCurrentSlug(slug);

  const expanded = ensureAncestorsExpanded(f.path);
  if (expanded) {
    await renderList(getFiles(), owner, repo, branch);
  } else {
    updateActiveItem();
  }

  let raw;
  let isGistContent = false;
  let isCodexContent = false;
  let gistUrl = null;
  let codexUrl = null;

  let cached = cacheRaw.get(slug);
  if (cached) {
    if (typeof cached === 'string') {
      raw = cached;
    } else {
      if (cached.gistUrl) {
        isGistContent = true;
        gistUrl = cached.gistUrl;
        try {
          const finalRawUrl = cached.rawGistUrl || await resolveGistRawUrl(cached.gistUrl);
          const gistBody = await fetchGistContent(finalRawUrl, cacheRaw);
          raw = gistBody;
          cached.body = gistBody;
          cached.rawGistUrl = finalRawUrl;
        } catch (err) {
          console.error('Failed to refetch gist:', err);
          raw = cached.body || `Error loading gist: ${err.message}`;
        }
      } else if (cached.codexUrl) {
        isCodexContent = true;
        codexUrl = cached.codexUrl;
        raw = cached.body;
      } else {
        raw = cached.body || cached;
      }
    }
  } else {
    const text = await fetchRawFile(owner, repo, branch, f.path);
    const trimmed = text.trim();

    if (isGistUrl(trimmed)) {
      isGistContent = true;
      gistUrl = trimmed;
      try {
        const rawGistUrl = await resolveGistRawUrl(trimmed);
        const gistBody = await fetchGistContent(rawGistUrl, cacheRaw);
        raw = gistBody;
        cacheRaw.set(slug, { body: gistBody, gistUrl: trimmed, rawGistUrl });
      } catch (err) {
        console.error('Failed to fetch gist:', err);
        raw = text;
        cacheRaw.set(slug, { body: text, gistUrl: trimmed, error: err.message });
      }
    } else if (CODEX_URL_REGEX.test(trimmed)) {
      isCodexContent = true;
      codexUrl = trimmed;
      raw = trimmed;
      cacheRaw.set(slug, { body: raw, codexUrl: trimmed });
    } else {
      raw = text;
      cacheRaw.set(slug, raw);
    }
  }

  // Update button states and links
  const moreEditBtn = document.getElementById('moreEditBtn');
  const moreGhBtn = document.getElementById('moreGhBtn');
  const moreRawBtn = document.getElementById('moreRawBtn');
  
  if (isGistContent && gistUrl) {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    editBtn.title = 'Edit the gist link';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on Gist';
    ghBtn.title = 'Open the gist on GitHub';
    ghBtn.href = gistUrl;
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on Gist';
    
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    const blob = new Blob([raw], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    currentBlobUrl = dataUrl;
    rawBtn.href = dataUrl;
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open gist content in new tab';
  } else if (isCodexContent && codexUrl) {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    editBtn.title = 'Edit the codex link';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit Link';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span> View on Codex';
    ghBtn.title = 'Open the conversation on Codex';
    ghBtn.href = codexUrl;
    ghBtn.target = '_blank';
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">chat_bubble</span> View on Codex';
    
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    const blob = new Blob([codexUrl], { type: 'text/plain' });
    const dataUrl = URL.createObjectURL(blob);
    currentBlobUrl = dataUrl;
    rawBtn.href = dataUrl;
    rawBtn.target = '_blank';
    rawBtn.removeAttribute('download');
    rawBtn.title = 'Open raw link in new tab';
  } else {
    editBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit on GitHub';
    editBtn.title = 'Edit the file on GitHub';
    if (moreEditBtn) moreEditBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">edit</span> Edit on GitHub';
    
    ghBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on GitHub';
    ghBtn.title = 'Open the file on GitHub';
    ghBtn.href = `https://github.com/${owner}/${repo}/blob/${branch}/${f.path}`;
    if (moreGhBtn) moreGhBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">folder</span> View on GitHub';
    
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    rawBtn.href = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`;
    rawBtn.title = 'Open raw markdown';
  }
  editBtn.href = `https://github.com/${owner}/${repo}/edit/${branch}/${f.path}`;

  if (isCodexContent) {
    toggleVisibility(copyBtn, false);
    shareBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
  } else {
    toggleVisibility(copyBtn, true);
    copyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy prompt';
    shareBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
  }

  // Update title and content
  const firstLine = raw.split(/\r?\n/)[0];
  if (/^#\s+/.test(firstLine)) {
    titleEl.textContent = firstLine.replace(/^#\s+/, '');
  }

  // Lazy load marked.js with fallback
  try {
    const marked = await loadMarked();

    if (!marked) {
      throw new Error('marked.js loaded but undefined');
    }

    if (isGistContent) {
      const looksLikeMarkdown = /^#|^\*|^-|^\d+\.|```/.test(raw.trim());
      if (!looksLikeMarkdown) {
        const wrappedContent = '```\n' + raw + '\n```';
        contentEl.innerHTML = sanitizeHtml(marked.parse(wrappedContent, { breaks: true }));
      } else {
        contentEl.innerHTML = sanitizeHtml(marked.parse(raw, { breaks: true }));
      }
    } else {
      contentEl.innerHTML = sanitizeHtml(marked.parse(raw, { breaks: true }));
    }
  } catch (err) {
    console.error('Failed to load marked.js or parse markdown:', err);
    showToast('Markdown rendering unavailable', 'error');

    contentEl.innerHTML = '';

    // Warning banner
    const warningDiv = document.createElement('div');
    warningDiv.className = 'markdown-warning';
    warningDiv.textContent = '⚠ Markdown rendering unavailable. Displaying raw text.';
    contentEl.appendChild(warningDiv);

    // Raw text fallback
    const pre = document.createElement('pre');
    pre.className = 'markdown-fallback';
    pre.textContent = raw;
    contentEl.appendChild(pre);
  }

  setCurrentPromptText(raw);
  enhanceCodeBlocks();
}

function enhanceCodeBlocks() {
  const pres = contentEl.querySelectorAll('pre');
  pres.forEach((pre) => {
    if (pre.querySelector('.copy-code-btn')) return;
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">content_copy</span>';
    btn.className = 'copy-code-btn';
    btn.dataset.action = 'copy-code';
    btn.title = 'Copy code';
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
  });
  
  if (!contentEl.dataset.codeBlockListenerAttached) {
    contentEl.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-action="copy-code"]');
      if (btn) {
        const pre = btn.previousElementSibling;
        if (pre && pre.tagName === 'PRE') {
          const code = pre.innerText;
          const success = await copyText(code);
          if (success) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span>';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.innerHTML = originalHTML;
              btn.classList.remove('copied');
            }, TIMEOUTS.copyFeedback);
          } else {
            statusBar.showMessage('Failed to copy to clipboard', { type: 'error' });
          }
        }
      }
    });
    contentEl.dataset.codeBlockListenerAttached = 'true';
  }
}

async function handleCopyPrompt() {
  let contentToCopy;
  let buttonText;

  const isCodex = getCurrentPromptText() && CODEX_URL_REGEX.test(getCurrentPromptText().trim());
  if (isCodex) {
    contentToCopy = getCurrentPromptText();
    buttonText = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy link';
  } else {
    contentToCopy = getCurrentPromptText();
    buttonText = '<span class="icon icon-inline" aria-hidden="true">content_copy</span> Copy prompt';
  }

  const success = await copyText(contentToCopy);
  if (success) {
    copyBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Copied';
    setTimeout(() => (copyBtn.innerHTML = buttonText), TIMEOUTS.copyFeedback);
  } else {
    showToast('Clipboard blocked. Select and copy manually.', 'warn');
  }
}

async function handleCopenPrompt(target) {
  const promptText = getCurrentPromptText();
  await copyAndOpen(target, promptText);
}

async function handleShareLink() {
  const success = await copyText(location.href);
  if (success) {
    shareBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Link copied';
  } else {
    showToast('Could not copy link.', 'warn');
  }
  const originalText = '<span class="icon icon-inline" aria-hidden="true">link</span> Copy link';
  setTimeout(() => (shareBtn.innerHTML = originalText), TIMEOUTS.copyFeedback);
}
