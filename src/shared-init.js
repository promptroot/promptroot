// ===== Shared Header Initialization =====
// This script automatically loads header on all pages

import { loadHeader } from './modules/header.js';
import { initAuthStateListener } from './modules/auth.js';
import { initBranchSelector, loadBranches, loadBranchFromStorage } from './modules/branch-selector.js';
import { OWNER, REPO, BRANCH, ERRORS } from './utils/constants.js';
import { parseParams } from './utils/url-params.js';
import statusBar from './modules/status-bar.js';
import { getFirebaseReady } from './firebase-init.js';
import { waitForDOMReady } from './utils/dom-helpers.js';
import { fetchJSON } from './modules/github-api.js';

let isInitialized = false;

async function waitForFirebase() {
  try {
    await getFirebaseReady();
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    statusBar.showMessage(ERRORS.FIREBASE_NOT_READY, 'error');
    throw error;
  }
}

function showUpdateBanner(latestDate, latestSha) {
  if (document.getElementById('updateBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.classList.add('update-banner');

  const message = document.createElement('span');
  message.textContent = `Update available: v${latestDate} (${latestSha})`;
  message.classList.add('update-banner__message');

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('update-banner__actions');

  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.classList.add('update-banner__button');
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });

  const dismissButton = document.createElement('button');
  dismissButton.textContent = '×';
  dismissButton.classList.add('update-banner__dismiss');
  dismissButton.addEventListener('click', () => {
    localStorage.setItem(`dismissed-version-${latestSha}`, 'true');
    banner.remove();
    document.body.classList.remove('has-version-banner');
  });

  buttonContainer.appendChild(refreshButton);
  buttonContainer.appendChild(dismissButton);

  banner.appendChild(message);
  banner.appendChild(buttonContainer);

  document.body.insertBefore(banner, document.body.firstChild);

  document.body.classList.add('has-version-banner');
}

async function fetchVersion() {
  const appVersion = document.getElementById('appVersion');
  if (!appVersion) {
    return;
  }
  
  try {
    const latestData = await fetchJSON(`https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
    if (!latestData) {
      console.warn('Version check: GitHub API request failed (possibly rate limited)');
      if (appVersion) {
        appVersion.textContent = 'version check rate limited';
        appVersion.classList.add('version-badge');
      }
      return;
    }
    const latestSha = latestData.sha.substring(0, 7);
    const latestDate = new Date(latestData.commit.committer.date);
    const latestDateStr = latestDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
    
    const currentVersionMeta = document.querySelector('meta[name="app-version"]');
    let currentDate = latestDate;
    let currentSha = latestSha;
    let currentDateStr = latestDateStr;
    if (currentVersionMeta) {
      const versionContent = currentVersionMeta.content; // Format: "sha|date"
      const [metaSha, metaDate] = versionContent.split('|');
      if (metaSha && metaDate) {
        currentSha = metaSha;
        currentDate = new Date(metaDate);
        currentDateStr = new Date(metaDate).toLocaleDateString('en-CA');
      }
    }

    if (currentDate < latestDate) {
      appVersion.textContent = `v${currentDateStr} (${currentSha})`;
      appVersion.classList.add('version-badge', 'status-outdated');
    } else {
      appVersion.textContent = `v${latestDateStr} (${latestSha})`;
      appVersion.classList.add('version-badge');
      appVersion.classList.remove('status-outdated');
    }
    
    const dismissed = localStorage.getItem(`dismissed-version-${latestSha}`);
    if (dismissed) {
      return;
    }
    if (currentDate < latestDate) {
      showUpdateBanner(latestDateStr, latestSha);
    }
    
  } catch (error) {
    if (appVersion) {
      appVersion.textContent = 'version unavailable';
    }
  }
}

async function initializeSharedComponents(activePage) {
  if (isInitialized) {
    return;
  }
  
  isInitialized = true;

  try {
    await loadHeader();
    
    // Set active nav item
    if (activePage) {
      const navItem = document.querySelector(`.nav-item[data-page="${activePage}"]`);
      if (navItem) {
        navItem.classList.add('active');
      }
    }

    try {
      await waitForFirebase();
    } catch (e) {
      // Error already handled in waitForFirebase with status bar message
      console.error('Firebase initialization failed, skipping auth-dependent initialization');
      return;
    }

    await initAuthStateListener();

    const params = parseParams();
    const currentOwner = params.owner || OWNER;
    const currentRepo = params.repo || REPO;
    const currentBranch = params.branch || loadBranchFromStorage(currentOwner, currentRepo) || BRANCH;

    await initBranchSelector(currentOwner, currentRepo, currentBranch);

    loadBranches().catch(error => {
      console.error('Failed to load branches:', error);
    });

    const repoPill = document.getElementById('repoPill');
    if (repoPill) {
      const strong = document.createElement('strong');
      strong.textContent = `${currentOwner}/${currentRepo}`;
      repoPill.replaceChildren(strong);
    }

    fetchVersion();

    const statusBarElement = document.getElementById('statusBar');
    if (statusBarElement) {
      statusBar.init();
    }

  } catch (error) {
    isInitialized = false; // Reset so it can be tried again
  }
}

waitForDOMReady(() => {
  const activePage = document.body.getAttribute('data-page') || 'home';
  initializeSharedComponents(activePage);
});

export { initializeSharedComponents, waitForFirebase };