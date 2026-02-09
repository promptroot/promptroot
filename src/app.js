// ===== Main App Initialization =====

import { OWNER, REPO, BRANCH, STORAGE_KEYS } from './utils/constants.js';
import { parseParams, getHashParam } from './utils/url-params.js';
import statusBar from './modules/status-bar.js';
import { initPromptList, loadList, loadExpandedState, renderList, setSelectFileCallback, setRepoContext } from './modules/prompt-list.js';
import { initPromptRenderer, selectBySlug, selectFile, setHandleTryInJulesCallback } from './modules/prompt-renderer.js';
import { setCurrentBranch, setCurrentRepo, loadBranchFromStorage } from './modules/branch-selector.js';
import { initSidebar } from './modules/sidebar.js';

// App state
let currentOwner = OWNER;
let currentRepo = REPO;
let currentBranch = BRANCH;

// Lazy Jules module loaders
async function lazyHandleTryInJules(promptText) {
  // Check for variables in prompt text
  const { detectPlaceholders, showVariableModal } = await import('./modules/variable-substitution.js');
  const placeholders = detectPlaceholders(promptText);
  
  let textToSend = promptText;
  
  // If placeholders exist, show variable modal first
  if (placeholders.length > 0) {
    const substitutedText = await showVariableModal(placeholders, promptText);
    
    // If user cancelled, don't proceed
    if (substitutedText === null) {
      return;
    }
    
    textToSend = substitutedText;
  }
  
  // Proceed with Jules flow
  await ensureJulesModalInit();
  const { handleTryInJules } = await import('./modules/jules-api.js');
  return handleTryInJules(textToSend);
}

let julesModalInitialized = false;
async function ensureJulesModalInit() {
  if (!julesModalInitialized) {
    const { initJulesKeyModalListeners } = await import('./modules/jules-modal.js');
    initJulesKeyModalListeners();
    julesModalInitialized = true;
  }
}

export function initApp() {
  const params = parseParams();
  if (params.owner) currentOwner = params.owner;
  if (params.repo) currentRepo = params.repo;
  currentBranch = params.branch || loadBranchFromStorage(currentOwner, currentRepo) || currentBranch;

  // Set up callbacks to avoid circular dependencies
  setSelectFileCallback(selectFile);
  setHandleTryInJulesCallback(lazyHandleTryInJules);

  // Initialize modules
  initPromptList();
  initPromptRenderer();
  // Jules modal now loads on-demand when needed
  
  // Init status bar
  statusBar.init();

  // Set repo context for prompt list
  setRepoContext(currentOwner, currentRepo, currentBranch);

  // Load prompts
  loadPrompts();

  // Setup event listeners
  setupEventListeners();
  
  // Initialize sidebar toggle
  initSidebar();
}

async function loadPrompts() {
  const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
  const files = await loadList(currentOwner, currentRepo, currentBranch, cacheKey);

  const hashSlug = parseParams().p;
  if (hashSlug) {
    await selectBySlug(hashSlug, files, currentOwner, currentRepo, currentBranch);
  } else {
    const { showFreeInputForm } = await import('./modules/jules-free-input.js');
    showFreeInputForm();
  }
}

function setupEventListeners() {
  window.addEventListener('hashchange', async () => {
    try {
      const params = parseParams();
      const prevOwner = currentOwner;
      const prevRepo = currentRepo;
      const prevBranch = currentBranch;

      if (params.owner) currentOwner = params.owner;
      if (params.repo) currentRepo = params.repo;
      if (params.branch) currentBranch = params.branch;

      const repoChanged = currentOwner !== prevOwner || currentRepo !== prevRepo;
      const branchChanged = currentBranch !== prevBranch;

      if (repoChanged || branchChanged) {
        setCurrentRepo(currentOwner, currentRepo);
        setCurrentBranch(currentBranch);
        const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
        sessionStorage.removeItem(cacheKey);
        await loadPrompts();
        await loadBranches();
      } else {
        // Just switching prompt
        const hashSlug = params.p;
        if (hashSlug) {
          const { getFiles } = await import('./modules/prompt-list.js');
          await selectBySlug(hashSlug, getFiles(), currentOwner, currentRepo, currentBranch);
        }
      }
    } catch (error) {
      console.error('Error handling hashchange:', {
        error,
        context: 'app.hashchange'
      });
    }
  });

  // Handle back/forward buttons
  window.addEventListener('popstate', async () => {
    try {
      const params = parseParams();
      const changed =
        (params.owner && params.owner !== currentOwner) ||
        (params.repo && params.repo !== currentRepo) ||
        (params.branch && params.branch !== currentBranch);

      if (changed) {
        currentOwner = params.owner || currentOwner;
        currentRepo = params.repo || currentRepo;
        currentBranch = params.branch || currentBranch;
        setCurrentRepo(currentOwner, currentRepo);
        setCurrentBranch(currentBranch);
        const cacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, currentBranch);
        sessionStorage.removeItem(cacheKey);
        await loadPrompts();
        await loadBranches();
      }
    } catch (error) {
      console.error('Error handling popstate:', {
        error,
        context: 'app.popstate'
      });
    }
  });

  window.addEventListener('branchChanged', async (e) => {
    try {
      currentBranch = e.detail.branch;
      setRepoContext(currentOwner, currentRepo, currentBranch);
      await loadPrompts();
      
      const repoPill = document.getElementById('repoPill');
      if (repoPill) {
        repoPill.textContent = `${currentOwner}/${currentRepo}`;
      }
    } catch (error) {
      console.error('Error handling branchChanged:', {
        error,
        context: 'app.branchChanged',
        detail: e.detail
      });
    }
  });
}
