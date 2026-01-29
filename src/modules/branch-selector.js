import { getDb } from './firebase-service.js';
import { FEATURE_PATTERNS, STORAGE_KEYS, HARDCODED_FAVORITE_BRANCHES } from '../utils/constants.js';
import { getBranches } from './github-api.js';
import { getCache, setCache, CACHE_KEYS } from '../utils/session-cache.js';
import { initDropdown } from './dropdown.js';
import { getCurrentUser } from './auth.js';

let branchSelect = null;
let branchDropdownBtn = null;
let branchDropdownMenu = null;
let branchDropdown = null;
let dropdownControl = null;
let currentBranch = null;
let currentOwner = null;
let currentRepo = null;
let favoriteBranches = [];
let allBranches = [];
let allBranchesLoaded = false;

export function initBranchSelector(owner, repo, branch) {
  branchSelect = document.getElementById('branchSelect');
  branchDropdownBtn = document.getElementById('branchDropdownBtn');
  branchDropdownMenu = document.getElementById('branchDropdownMenu');
  branchDropdown = document.getElementById('branchDropdown');
  currentOwner = owner;
  currentRepo = repo;
  const savedBranch = loadBranchFromStorage(owner, repo);
  currentBranch = savedBranch || branch;

  // Load favorites from Firestore
  loadFavoriteBranches();

  if (branchSelect) {
    branchSelect.addEventListener('change', handleBranchChange);
  }

  if (branchDropdownBtn && branchDropdownMenu) {
    dropdownControl = initDropdown(branchDropdownBtn, branchDropdownMenu, branchDropdown);
  }
}

export function setCurrentBranch(branch) {
  currentBranch = branch;
  if (branchSelect) {
    branchSelect.value = branch;
  }
  
  // Persist to localStorage
  saveBranchToStorage(branch, currentOwner, currentRepo);
}

function saveBranchToStorage(branch, owner, repo) {
  if (branch && owner && repo) {
    try {
      localStorage.setItem('selectedBranch', JSON.stringify({
        branch,
        owner,
        repo,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving branch to storage:', {
        error,
        context: 'saveBranchToStorage',
        branch, owner, repo
      });
    }
  }
}

export function loadBranchFromStorage(owner, repo) {
  try {
    const stored = localStorage.getItem('selectedBranch');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.owner === owner && data.repo === repo) {
        return data.branch;
      }
    }
  } catch (error) {
    console.error('Error loading branch from storage:', {
      error,
      context: 'loadBranchFromStorage',
      owner, repo
    });
  }
  return null;
}

export function getCurrentBranch() {
  return currentBranch;
}

export function getCurrentRepo() {
  return { owner: currentOwner, repo: currentRepo };
}

/**
 * Loads favorite branches from Firestore for the current user
 */
async function loadFavoriteBranches() {
  const user = getCurrentUser();
  const db = getDb();
  if (!user || !db) {
    favoriteBranches = [...HARDCODED_FAVORITE_BRANCHES];
    return;
  }

  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().favoriteBranches) {
      // Merge user favorites with hardcoded favorites
      const userFavorites = doc.data().favoriteBranches || [];
      favoriteBranches = [...new Set([...HARDCODED_FAVORITE_BRANCHES, ...userFavorites])];
    } else {
      favoriteBranches = [...HARDCODED_FAVORITE_BRANCHES];
    }
  } catch (error) {
    console.error('Failed to load favorite branches:', error);
    favoriteBranches = [...HARDCODED_FAVORITE_BRANCHES];
  }
}

/**
 * Saves favorite branches to Firestore for the current user
 */
async function saveFavoriteBranches(newFavorites) {
  const user = getCurrentUser();
  const db = getDb();
  if (!user || !db) {
    return;
  }

  try {
    // Filter out hardcoded favorites before saving (they're always included)
    const userFavorites = newFavorites.filter(b => !HARDCODED_FAVORITE_BRANCHES.includes(b));
    
    await db.collection('users').doc(user.uid).set({
      favoriteBranches: userFavorites
    }, { merge: true });
    
    favoriteBranches = newFavorites;
  } catch (error) {
    console.error('Failed to save favorite branches:', error);
  }
}

/**
 * Adds a branch to favorites
 */
async function addFavoriteBranch(branchName) {
  if (!favoriteBranches.includes(branchName)) {
    const newFavorites = [...favoriteBranches, branchName];
    await saveFavoriteBranches(newFavorites);
  }
}

/**
 * Removes a branch from favorites (hardcoded favorites cannot be removed)
 */
async function removeFavoriteBranch(branchName) {
  if (HARDCODED_FAVORITE_BRANCHES.includes(branchName)) {
    return; // Cannot remove hardcoded favorites
  }
  
  const newFavorites = favoriteBranches.filter(b => b !== branchName);
  await saveFavoriteBranches(newFavorites);
}

/**
 * Checks if a branch is favorited
 */
function isBranchFavorited(branchName) {
  return favoriteBranches.includes(branchName);
}

/**
 * Creates a branch dropdown item with star for favorites
 */
function createBranchItem(branchName, isSelected, onClickItem, onClickStar) {
  const isFav = isBranchFavorited(branchName);
  const canToggle = !HARDCODED_FAVORITE_BRANCHES.includes(branchName);
  
  const item = document.createElement('div');
  item.className = 'dropdown-item-with-star';
  if (isSelected) item.classList.add('selected');
  
  const star = document.createElement('span');
  star.className = 'icon icon-inline star-icon';
  star.setAttribute('aria-hidden', 'true');
  star.textContent = 'star';
  star.dataset.favorited = isFav.toString();
  
  if (!canToggle) {
    star.classList.add('star-icon--disabled');
    star.title = 'This is a permanent favorite';
  }
  
  star.onclick = (e) => {
    e.stopPropagation();
    if (canToggle && onClickStar) onClickStar(branchName, isFav);
  };
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'item-name';
  nameSpan.textContent = branchName;
  
  item.onclick = () => {
    if (onClickItem) onClickItem(branchName);
  };
  
  item.appendChild(star);
  item.appendChild(nameSpan);
  
  return item;
}

export function setCurrentRepo(owner, repo) {
  currentOwner = owner;
  currentRepo = repo;
  
  // Try to restore branch from storage for this repo
  const savedBranch = loadBranchFromStorage(owner, repo);
  if (savedBranch) {
    currentBranch = savedBranch;
  }
}

function classifyBranch(branchName) {
  if (branchName === 'main' || branchName === 'master' || branchName === 'web-captures') {
    return 'main';
  }

  if (
    branchName.startsWith('codex/') ||
    /^\d+-/.test(branchName) ||
    FEATURE_PATTERNS.some(p => branchName.includes(p)) ||
    (/^[a-zA-Z][a-zA-Z0-9]*$/.test(branchName) && branchName.length >= 15)
  ) {
    return 'feature';
  }

  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(branchName) && branchName.length < 15) {
    return 'user';
  }

  return 'feature';
}

function toggleFeatureBranches() {
  const showFeatures = localStorage.getItem('showFeatureBranches') === 'true';
  const newShowFeatures = !showFeatures;
  localStorage.setItem('showFeatureBranches', newShowFeatures.toString());
  loadBranches();
}

function toggleUserBranches() {
  const showUsers = localStorage.getItem('showUserBranches') !== 'false';
  const newShowUsers = !showUsers;
  localStorage.setItem('showUserBranches', newShowUsers.toString());
  loadBranches();
}

async function handleBranchChange(e) {
  if (!branchSelect) return;

  if (branchSelect.value === '__toggle_features__') {
    toggleFeatureBranches();
    return;
  }

  if (branchSelect.value === '__toggle_users__') {
    toggleUserBranches();
    return;
  }

  const oldBranch = currentBranch;
  currentBranch = branchSelect.value;
  
  saveBranchToStorage(currentBranch, currentOwner, currentRepo);

  // Update custom dropdown label
  const labelEl = document.getElementById('branchDropdownLabel');
  if (labelEl) labelEl.textContent = currentBranch;

  const qs = new URLSearchParams(location.search);
  qs.set('branch', currentBranch);
  const slugMatch = location.hash.match(/[#&?]p=([^&]+)/) || location.hash.match(/^#([^&]+)$/);
  const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : null;

  const newUrl = `${location.pathname}?${qs.toString()}${slug ? '#p=' + encodeURIComponent(slug) : ''}`;
  history.replaceState(null, '', newUrl);

  const oldCacheKey = STORAGE_KEYS.promptsCache(currentOwner, currentRepo, oldBranch);
  sessionStorage.removeItem(oldCacheKey);
  window.dispatchEvent(new CustomEvent('branchChanged', { detail: { branch: currentBranch } }));
}

export async function loadBranches() {
  if (!branchSelect) return;

  branchSelect.disabled = true;
  branchSelect.replaceChildren();
  const loadingOpt = document.createElement('option');
  loadingOpt.textContent = 'Loading branches…';
  branchSelect.appendChild(loadingOpt);

  try {
    // Check cache first
    const cacheScopeKey = `${currentOwner}/${currentRepo}`;
    const userId = getCurrentUser()?.uid || null;
    let branches = getCache(CACHE_KEYS.BRANCHES, userId, cacheScopeKey);
    
    if (!branches) {
      // Load from API and cache
      branches = await getBranches(currentOwner, currentRepo);
      setCache(CACHE_KEYS.BRANCHES, branches, userId, cacheScopeKey);
    }

    allBranches = branches;
    allBranchesLoaded = true;

    const mainBranches = [];
    const userBranchesArr = [];
    const featureBranches = [];

    for (const b of branches) {
      const category = classifyBranch(b.name);
      switch (category) {
        case 'main':
          mainBranches.push(b);
          break;
        case 'user':
          userBranchesArr.push(b);
          break;
        case 'feature':
          featureBranches.push(b);
          break;
      }
    }

    userBranchesArr.sort((a, b) => a.name.localeCompare(b.name));
    featureBranches.sort((a, b) => a.name.localeCompare(b.name));

    branchSelect.replaceChildren();

    for (const b of mainBranches) {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      branchSelect.appendChild(opt);
    }

    // User branches
    if (userBranchesArr.length > 0) {
      const showUsers = localStorage.getItem('showUserBranches') !== 'false';
      const userGroup = document.createElement('optgroup');
      userGroup.label = `${showUsers ? '▼' : '▶'} User Branches (${userBranchesArr.length})`;

      if (showUsers) {
        for (const b of userBranchesArr) {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = `  ${b.name}`;
          userGroup.appendChild(opt);
        }
      }
      branchSelect.appendChild(userGroup);
    }

    if (featureBranches.length > 0) {
      const showFeatures = localStorage.getItem('showFeatureBranches') === 'true';
      const featureGroup = document.createElement('optgroup');
      featureGroup.label = `${showFeatures ? '▼' : '▶'} Feature Branches (${featureBranches.length})`;

      if (showFeatures) {
        for (const b of featureBranches) {
          const opt = document.createElement('option');
          opt.value = b.name;
          opt.textContent = `  ${b.name}`;
          featureGroup.appendChild(opt);
        }
      }
      branchSelect.appendChild(featureGroup);
    }

    if (![...branchSelect.options].some(o => o.value === currentBranch)) {
      const opt = document.createElement('option');
      opt.value = currentBranch;
      opt.textContent = `${currentBranch}`;
      branchSelect.appendChild(opt);
    }

    branchSelect.value = currentBranch;
    branchSelect.title = '';

    // Populate custom dropdown menu with favorites support
    await populateCustomDropdownMenu(branches);
  } catch (e) {
    branchSelect.replaceChildren();
    const errorOpt = document.createElement('option');
    errorOpt.value = currentBranch;
    errorOpt.textContent = currentBranch;
    branchSelect.appendChild(errorOpt);
    branchSelect.title = (e && e.message) ? e.message : 'Failed to load branches';
  } finally {
    branchSelect.disabled = false;
  }
}

/**
 * Populates the custom dropdown menu with favorites and show more functionality
 */
async function populateCustomDropdownMenu(branches) {
  if (!branchDropdownMenu || !branchDropdownBtn) return;

  branchDropdownMenu.replaceChildren();

  // Always show current branch at the top
  const currentBranchObj = branches.find(b => b.name === currentBranch);
  if (currentBranchObj) {
    const currentHeader = document.createElement('div');
    currentHeader.className = 'dropdown-group-header';
    currentHeader.textContent = 'Current Branch';
    branchDropdownMenu.appendChild(currentHeader);
    
    const currentItem = createBranchItem(
      currentBranchObj.name,
      true,
      null, // Don't switch to current branch
      async (branchName, isFav) => {
        if (isFav) {
          await removeFavoriteBranch(branchName);
        } else {
          await addFavoriteBranch(branchName);
        }
        await populateCustomDropdownMenu(allBranches);
      }
    );
    currentItem.onclick = () => {
      if (dropdownControl) dropdownControl.close();
    };
    branchDropdownMenu.appendChild(currentItem);
  }

  // Get favorite branches that exist in the repo (excluding current branch)
  const favBranches = branches.filter(b => isBranchFavorited(b.name) && b.name !== currentBranch);
  const nonFavBranches = branches.filter(b => !isBranchFavorited(b.name) && b.name !== currentBranch);

  // Add favorites section
  if (favBranches.length > 0) {
    const favHeader = document.createElement('div');
    favHeader.className = 'dropdown-group-header';
    favHeader.textContent = `Favorites (${favBranches.length})`;
    branchDropdownMenu.appendChild(favHeader);

    for (const branch of favBranches) {
      const item = createBranchItem(
        branch.name,
        false,
        async (branchName) => {
          branchSelect.value = branchName;
          await handleBranchChange();
          if (dropdownControl) dropdownControl.close();
          await populateCustomDropdownMenu(allBranches);
        },
        async (branchName) => {
          await removeFavoriteBranch(branchName);
          await populateCustomDropdownMenu(allBranches);
        }
      );
      branchDropdownMenu.appendChild(item);
    }
  }

  // Add "Show more" button
  if (nonFavBranches.length > 0) {
    const showMoreBtn = document.createElement('div');
    showMoreBtn.className = 'dropdown-show-more';
    showMoreBtn.textContent = favBranches.length > 0 ? '▼ Show more branches...' : '▼ Show all branches...';
    
    showMoreBtn.onclick = () => {
      showMoreBtn.classList.add('hidden');
      renderAllBranches(nonFavBranches);
    };
    
    branchDropdownMenu.appendChild(showMoreBtn);
  } else if (favBranches.length === 0) {
    // No branches at all
    const helperDiv = document.createElement('div');
    helperDiv.className = 'dropdown-helper-text';
    helperDiv.textContent = 'Click ★ next to any branch to add it to favorites';
    branchDropdownMenu.appendChild(helperDiv);
  }

  // Update label
  const labelEl = document.getElementById('branchDropdownLabel');
  if (labelEl) labelEl.textContent = currentBranch;
}

/**
 * Renders all non-favorite branches in the dropdown
 */
function renderAllBranches(nonFavBranches) {
  if (!branchDropdownMenu) return;

  // Add helper text if there are no favorites yet
  if (favoriteBranches.length === 0 || favoriteBranches.every(f => HARDCODED_FAVORITE_BRANCHES.includes(f))) {
    const helperDiv = document.createElement('div');
    helperDiv.className = 'dropdown-helper-text';
    helperDiv.textContent = 'Click ★ next to any branch to add it to favorites';
    branchDropdownMenu.appendChild(helperDiv);
  }

  // Group branches
  const mainBranches = [];
  const userBranchesArr = [];
  const featureBranches = [];

  for (const b of nonFavBranches) {
    const category = classifyBranch(b.name);
    switch (category) {
      case 'main':
        mainBranches.push(b);
        break;
      case 'user':
        userBranchesArr.push(b);
        break;
      case 'feature':
        featureBranches.push(b);
        break;
    }
  }

  // Add main branches
  if (mainBranches.length > 0) {
    const header = document.createElement('div');
    header.className = 'dropdown-group-header';
    header.textContent = `Main Branches (${mainBranches.length})`;
    branchDropdownMenu.appendChild(header);

    for (const branch of mainBranches) {
      const item = createBranchItem(
        branch.name,
        false,
        async (branchName) => {
          branchSelect.value = branchName;
          await handleBranchChange();
          if (dropdownControl) dropdownControl.close();
          await populateCustomDropdownMenu(allBranches);
        },
        async (branchName) => {
          await addFavoriteBranch(branchName);
          await populateCustomDropdownMenu(allBranches);
        }
      );
      branchDropdownMenu.appendChild(item);
    }
  }

  // Add user branches
  if (userBranchesArr.length > 0) {
    const header = document.createElement('div');
    header.className = 'dropdown-group-header';
    header.textContent = `User Branches (${userBranchesArr.length})`;
    branchDropdownMenu.appendChild(header);

    userBranchesArr.sort((a, b) => a.name.localeCompare(b.name));

    for (const branch of userBranchesArr) {
      const item = createBranchItem(
        branch.name,
        false,
        async (branchName) => {
          branchSelect.value = branchName;
          await handleBranchChange();
          if (dropdownControl) dropdownControl.close();
          await populateCustomDropdownMenu(allBranches);
        },
        async (branchName) => {
          await addFavoriteBranch(branchName);
          await populateCustomDropdownMenu(allBranches);
        }
      );
      branchDropdownMenu.appendChild(item);
    }
  }

  // Add feature branches
  if (featureBranches.length > 0) {
    const header = document.createElement('div');
    header.className = 'dropdown-group-header';
    header.textContent = `Feature Branches (${featureBranches.length})`;
    branchDropdownMenu.appendChild(header);

    featureBranches.sort((a, b) => a.name.localeCompare(b.name));

    for (const branch of featureBranches) {
      const item = createBranchItem(
        branch.name,
        false,
        async (branchName) => {
          branchSelect.value = branchName;
          await handleBranchChange();
          if (dropdownControl) dropdownControl.close();
          await populateCustomDropdownMenu(allBranches);
        },
        async (branchName) => {
          await addFavoriteBranch(branchName);
          await populateCustomDropdownMenu(allBranches);
        }
      );
      branchDropdownMenu.appendChild(item);
    }
  }
}
