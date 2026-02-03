import { getCurrentUser } from './auth.js';
import { getDb } from './firebase-service.js';
import { showToast } from './toast.js';
import { toggleVisibility } from '../utils/dom-helpers.js';
import { loadFuse } from '../utils/lazy-loaders.js';

function extractDefaultBranch(source) {
  const defaultBranchObj = source?.githubRepo?.defaultBranch ||
                           source?.githubRepoContext?.defaultBranch || 
                           source?.defaultBranch;
  
  return typeof defaultBranchObj === 'string' 
    ? defaultBranchObj 
    : (defaultBranchObj?.displayName || 'main');
}

function setupClickOutsideClose(targetBtn, targetMenu) {
  // Remove any previously registered handler for this button, if present
  if (targetBtn._cleanupClickOutside) {
    targetBtn._cleanupClickOutside();
    delete targetBtn._cleanupClickOutside;
  }
  
  const closeDropdown = (e) => {
    if (!targetBtn.contains(e.target) && !targetMenu.contains(e.target)) {
      targetMenu.classList.remove('open');
      targetBtn.setAttribute('aria-expanded', 'false');
    }
  };
  
  document.addEventListener('click', closeDropdown);

  const cleanup = () => {
    document.removeEventListener('click', closeDropdown);
  };

  // Store cleanup on button to handle re-initialization
  targetBtn._cleanupClickOutside = cleanup;

  return cleanup;
}

export class RepoSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.onSelect = options.onSelect;
    this.branchSelector = options.branchSelector;
    this.showFavorites = options.showFavorites !== false;
    
    this.favorites = [];
    this.allSources = [];
    this.allReposLoaded = false;
    this.sourcesCache = null;
    this.selectedSourceId = null;
    this.searchInput = null;
    this.searchClearBtn = null;
    this.currentSearchTerm = '';
    this.cachedFuseInstance = null;

    // Bound handlers
    this.handleDropdownToggle = this.handleDropdownToggle.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleSearchClear = this.handleSearchClear.bind(this);

    this.cleanupClickOutside = null;
  }

  destroy() {
    if (this.dropdownBtn) {
      this.dropdownBtn.removeEventListener('click', this.handleDropdownToggle);
      if (this.cleanupClickOutside) {
        this.cleanupClickOutside();
        this.cleanupClickOutside = null;
      }
    }

    if (this.dropdownMenu) {
      this.dropdownMenu.removeEventListener('click', this.handleMenuClick);
    }

    if (this.searchInput) {
        this.searchInput.removeEventListener('input', this.handleSearchInput);
    }
    if (this.searchClearBtn) {
        this.searchClearBtn.removeEventListener('click', this.handleSearchClear);
    }
  }

  saveToStorage() {
    if (this.selectedSourceId) {
      localStorage.setItem('selectedRepoId', this.selectedSourceId);
    }
  }

  loadFromStorage() {
    try {
      return localStorage.getItem('selectedRepoId');
    } catch (error) {
      console.error('Failed to load repo from storage:', error);
    }
    return null;
  }

  getSelectedSourceId() {
    return this.selectedSourceId;
  }

  async initialize() {
    const user = getCurrentUser();
    if (!user) {
      this.dropdownText.textContent = 'Please sign in first';
      this.dropdownBtn.disabled = true;
      return;
    }

    this.dropdownBtn.disabled = false;

    const { DEFAULT_FAVORITE_REPOS } = await import('../utils/constants.js');
    
    this.favorites = DEFAULT_FAVORITE_REPOS;
    try {
      const db = getDb();
      if (db) {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists && doc.data().favoriteRepos) {
          this.favorites = doc.data().favoriteRepos;
        }
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }

    // Set ARIA attributes
    this.dropdownBtn.setAttribute('aria-haspopup', 'true');
    this.dropdownBtn.setAttribute('aria-expanded', 'false');
    this.dropdownMenu.setAttribute('role', 'menu');

    // Try to restore previous selection
    const savedRepoId = this.loadFromStorage();
    if (savedRepoId) {
      // Try to find the repo in favorites to get its display name
      const favorite = this.favorites.find(f => f.id === savedRepoId);
      if (favorite) {
        this.selectedSourceId = savedRepoId;
        this.dropdownText.textContent = favorite.name;
        
        // Restore branch selector if available
        let restoredBranch = favorite.branch;
        if (this.branchSelector) {
          const savedBranch = this.branchSelector.loadFromStorage();
          if (savedBranch && savedBranch.sourceId === savedRepoId) {
            restoredBranch = savedBranch.branch;
            this.branchSelector.initialize(savedRepoId, savedBranch.branch);
          } else if (favorite.branch) {
            this.branchSelector.initialize(savedRepoId, favorite.branch);
          }
        }
        // Notify parent component of restored selection
        if (this.onSelect) {
          this.onSelect(savedRepoId, restoredBranch, favorite.name);
        }
      } else {
        // Not in favorites, show generic text
        this.selectedSourceId = savedRepoId;
        const pathParts = savedRepoId.split('/');
        const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : savedRepoId;
        this.dropdownText.textContent = repoName;
        
        // Restore branch selector if available
        let restoredBranch = null;
        if (this.branchSelector) {
          const savedBranch = this.branchSelector.loadFromStorage();
          if (savedBranch && savedBranch.sourceId === savedRepoId) {
            restoredBranch = savedBranch.branch;
            this.branchSelector.initialize(savedRepoId, savedBranch.branch);
          }
        }
        // Notify parent component of restored selection
        if (this.onSelect && restoredBranch) {
          this.onSelect(savedRepoId, restoredBranch, repoName);
        }
      }
    } else {
      this.dropdownText.textContent = 'Select a repository...';
    }

    this.setupDropdownToggle();

    // Setup event delegation for the menu
    this.dropdownMenu.removeEventListener('click', this.handleMenuClick);
    this.dropdownMenu.addEventListener('click', this.handleMenuClick);
  }

  async handleDropdownToggle(e) {
    e.stopPropagation();
    if (this.dropdownMenu.classList.contains('open')) {
      this.dropdownMenu.classList.remove('open');
      this.dropdownMenu.style.display = '';
      this.dropdownBtn.setAttribute('aria-expanded', 'false');
      return;
    }

    this.dropdownBtn.setAttribute('aria-expanded', 'true');

    // Position dropdown menu if it's fixed (e.g., in modals)
    const computedStyle = window.getComputedStyle(this.dropdownMenu);
    if (computedStyle.position === 'fixed') {
      const rect = this.dropdownBtn.getBoundingClientRect();
      this.dropdownMenu.style.top = `${rect.bottom + 4}px`;
      this.dropdownMenu.style.left = `${rect.left}px`;
      this.dropdownMenu.style.width = `${rect.width}px`;
    }

    await this.populateDropdown();
  }

  setupDropdownToggle() {
    this.dropdownBtn.removeEventListener('click', this.handleDropdownToggle);
    this.dropdownBtn.addEventListener('click', this.handleDropdownToggle);

    this.cleanupClickOutside = setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  async handleMenuClick(e) {
    const target = e.target;

    // Handle Show More button
    if (target.closest('.dropdown-show-more')) {
        await this.handleShowMoreClick(target.closest('.dropdown-show-more'));
        return;
    }

    // Handle Search Wrapper click (prevent propagation)
    if (target.closest('.dropdown-search-wrapper')) {
        e.stopPropagation();
        return;
    }

    const starBtn = target.closest('.star-icon');
    if (starBtn) {
        e.stopPropagation();
        const item = starBtn.closest('.dropdown-item-with-star');
        // Check if button is interactive (not hidden visibility)
        if (starBtn.style.visibility === 'hidden') return;

        const id = item.dataset.id;
        const name = item.dataset.name;
        const isFavorite = starBtn.dataset.favorited === 'true';

        if (isFavorite) {
            await this.removeFavorite(id);
            // Refresh logic - close dropdown and repopulate
            this.dropdownMenu.classList.remove('open');
            this.dropdownMenu.style.display = '';
            this.dropdownBtn.setAttribute('aria-expanded', 'false');
            setTimeout(() => this.populateDropdown(), 0);
        } else {
            const defaultBranch = extractDefaultBranch(this.allSources.find(s => (s.name || s.id) === id));
            await this.addFavorite(id, name, defaultBranch);
            // In the original code, it removes the item.
            item.remove();
        }
        return;
    }

    const repoItem = target.closest('.dropdown-item-with-star');
    if (repoItem && !repoItem.classList.contains('dropdown-show-more')) {
        const id = repoItem.dataset.id;
        const name = repoItem.dataset.name;
        const isFavorite = repoItem.dataset.isFavorite === 'true';

        if (isFavorite) {
             this.handleFavoriteSelection(id, name);
        } else {
             const defaultBranch = repoItem.dataset.defaultBranch;
             this.handleRepoSelection(id, name, defaultBranch);
        }
    }
  }

  async handleFavoriteSelection(id, name) {
      this.selectedSourceId = id;
      this.dropdownText.textContent = name;
      this.dropdownMenu.classList.remove('open');
      this.dropdownMenu.style.display = '';

      this.saveToStorage();
      this.dropdownBtn.setAttribute('aria-expanded', 'false');

      const favorite = this.favorites.find(f => f.id === id);
      let currentBranch = favorite?.branch;

      if (!currentBranch) {
        if (this.branchSelector) {
          this.branchSelector.dropdownText.textContent = 'Detecting branch...';
          this.branchSelector.dropdownBtn.disabled = true;
        }
        currentBranch = await this.verifyDefaultBranch(favorite);
        if (this.branchSelector) {
          this.branchSelector.initialize(id, currentBranch);
        }
      } else {
        if (this.branchSelector) {
          this.branchSelector.initialize(id, currentBranch);
        }
        this.verifyDefaultBranch(favorite, true).catch((error) => {
          console.error('Failed to verify default branch in background:', error);
        });
      }

      if (this.onSelect) {
        this.onSelect(id, currentBranch, name);
      }
  }

  async handleRepoSelection(id, name, defaultBranch) {
      this.selectedSourceId = id;
      this.dropdownText.textContent = name;
      this.dropdownMenu.classList.remove('open');
      this.dropdownMenu.style.display = '';

      this.saveToStorage();
      this.dropdownBtn.setAttribute('aria-expanded', 'false');

      if (this.onSelect) {
        this.onSelect(id, defaultBranch, name);
      }
  }

  async handleShowMoreClick(showMoreBtn) {
      if (!this.allReposLoaded) {
        showMoreBtn.textContent = 'Loading...';
        showMoreBtn.classList.add('loading');

        try {
          await this.loadAllRepos();
          this.allReposLoaded = true;
          this.cachedFuseInstance = null; // Clear cache when new repos loaded
        } catch (error) {
          showMoreBtn.textContent = 'Failed to load - click to retry';
          showMoreBtn.classList.remove('loading');
          return;
        }
      }

      showMoreBtn.classList.add('hidden');

      // Add search input at the top before rendering all repos
      if (!this.dropdownMenu.querySelector('.dropdown-search-wrapper')) {
        const searchElement = this.createSearchInput();
        this.dropdownMenu.insertBefore(searchElement, this.dropdownMenu.firstChild);
      }
      
      this.renderAllRepos();
  }

  handleSearchInput(e) {
      const input = e.target;
      this.currentSearchTerm = input.value.toLowerCase().trim();

      // Show/hide clear button
      if (this.currentSearchTerm) {
        this.searchClearBtn.classList.remove('hidden');
      } else {
        this.searchClearBtn.classList.add('hidden');
      }
      
      // Re-render filtered repositories
      this.filterAndRenderRepos();
  }

  handleSearchClear(e) {
      e.stopPropagation();
      this.searchInput.value = '';
      this.currentSearchTerm = '';
      this.searchClearBtn.classList.add('hidden');
      this.searchInput.focus();
      this.filterAndRenderRepos();
  }

  /**
   * Creates a search input element for the repository dropdown
   */
  createSearchInput() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-search-wrapper';
    
    const inputContainer = document.createElement('div');
    inputContainer.style.position = 'relative';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dropdown-search';
    input.placeholder = 'Search repositories...';
    input.setAttribute('aria-label', 'Search repositories');
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'dropdown-search-clear hidden';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.innerHTML = '<span class="icon" aria-hidden="true">close</span>';
    
    input.addEventListener('input', this.handleSearchInput);
    clearBtn.addEventListener('click', this.handleSearchClear);
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(clearBtn);
    wrapper.appendChild(inputContainer);
    
    this.searchInput = input;
    this.searchClearBtn = clearBtn;
    
    return wrapper;
  }

  /**
   * Filters repositories based on current search term using Fuse.js fuzzy search
   */
  async filterRepos(repos) {
    if (!this.currentSearchTerm) return repos;
    
    // Lazy load Fuse only when actually searching
    if (!this.cachedFuseInstance) {
      const Fuse = await loadFuse();
      this.cachedFuseInstance = new Fuse(repos, {
        keys: ['name', 'id'],
        includeScore: true,
        threshold: 0.3,
        ignoreLocation: true
      });
    }
    
    const results = this.cachedFuseInstance.search(this.currentSearchTerm);
    return results.map(result => result.item);
  }

  /**
   * Re-renders repositories based on current search term
   */
  async filterAndRenderRepos() {
    if (!this.dropdownMenu) return;
    
    // Keep the search input at the top
    const searchWrapper = this.dropdownMenu.querySelector('.dropdown-search-wrapper');
    
    // Clear everything except search
    const items = Array.from(this.dropdownMenu.children);
    items.forEach(item => {
      if (!item.classList.contains('dropdown-search-wrapper')) {
        item.remove();
      }
    });
    
    // Get all repos (favorites + all sources)
    const allRepos = [];
    
    // Add favorites
    if (this.favorites && this.favorites.length > 0) {
      allRepos.push(...this.favorites.map(f => ({ ...f, isFavorite: true })));
    }
    
    // Add all sources if loaded
    if (this.allReposLoaded && this.allSources.length > 0) {
      this.allSources.forEach(source => {
        if (!this.favorites.some(f => f.id === (source.name || source.id))) {
          const fullPath = source.name || source.id;
          const pathParts = fullPath.split('/');
          const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : fullPath;
          allRepos.push({ id: source.name || source.id, name: repoName, isFavorite: false, source });
        }
      });
    }
    
    if (allRepos.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-helper-text';
      noResults.textContent = 'No repositories found';
      this.dropdownMenu.appendChild(noResults);
      return;
    }
    
    // Filter repositories
    const filtered = await this.filterRepos(allRepos);
    
    if (filtered.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-helper-text';
      noResults.textContent = 'No repositories found';
      this.dropdownMenu.appendChild(noResults);
      return;
    }
    
    // Separate favorites from others
    const filteredFavorites = filtered.filter(r => r.isFavorite);
    const filteredOthers = filtered.filter(r => !r.isFavorite);
    
    // Render favorites section
    if (filteredFavorites.length > 0) {
      const favHeader = document.createElement('div');
      favHeader.className = 'dropdown-group-header';
      favHeader.textContent = `Favorites (${filteredFavorites.length})`;
      this.dropdownMenu.appendChild(favHeader);
      
      for (const fav of filteredFavorites) {
        const item = this.createRepoItem(fav.name, fav.id, true);
        this.dropdownMenu.appendChild(item);
      }
    }
    
    // Render other repositories section
    if (filteredOthers.length > 0) {
      const otherHeader = document.createElement('div');
      otherHeader.className = 'dropdown-group-header';
      otherHeader.textContent = `Other Repositories (${filteredOthers.length})`;
      this.dropdownMenu.appendChild(otherHeader);
      
      for (const repo of filteredOthers) {
        const defaultBranch = repo.source ? extractDefaultBranch(repo.source) : 'main';
        const item = this.createRepoItem(repo.name, repo.id, false, defaultBranch);
        this.dropdownMenu.appendChild(item);
      }
    }
  }

  async populateDropdown() {
    this.dropdownMenu.innerHTML = '';
    
    // Reset search state
    this.currentSearchTerm = '';
    this.searchInput = null;
    this.searchClearBtn = null;
    this.cachedFuseInstance = null;
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'dropdown-loading';
    loadingIndicator.textContent = 'Loading...';
    this.dropdownMenu.appendChild(loadingIndicator);
    this.dropdownMenu.classList.add('open');
    this.dropdownMenu.style.display = '';
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    if (this.showFavorites && this.favorites && this.favorites.length > 0) {
      this.dropdownMenu.innerHTML = '';
      await this.renderFavorites();
      this.addShowMoreButton();
    } else {
      await this.loadAllRepos();
      this.dropdownMenu.innerHTML = '';
      
      // Add search input at the top when all repos are loaded
      const searchElement = this.createSearchInput();
      this.dropdownMenu.appendChild(searchElement);
      
      this.renderAllRepos();
    }
    
    this.dropdownMenu.classList.add('open');
    this.dropdownMenu.style.display = '';
  }

  async renderFavorites() {
    for (const fav of this.favorites) {
      const item = this.createRepoItem(fav.name, fav.id, true);
      this.dropdownMenu.appendChild(item);
    }
  }

  addShowMoreButton() {
    const showMoreBtn = document.createElement('div');
    showMoreBtn.className = 'dropdown-show-more';
    showMoreBtn.textContent = '▼ Show more...';
    this.dropdownMenu.appendChild(showMoreBtn);
  }

  async loadAllRepos() {
    const user = getCurrentUser();
    const { listJulesSources } = await import('./jules-api.js');
    const { getDecryptedJulesKey } = await import('./jules-api.js');
    
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const sourcesData = await listJulesSources(apiKey);
    this.allSources = sourcesData.sources || [];
    let nextPageToken = sourcesData.nextPageToken;
    
    while (nextPageToken) {
      const nextPage = await listJulesSources(apiKey, nextPageToken);
      this.allSources = this.allSources.concat(nextPage.sources || []);
      nextPageToken = nextPage.nextPageToken;
    }

    if (this.allSources.length === 0) {
      throw new Error('No repositories found');
    }
  }

  renderAllRepos() {
    if (!this.favorites || this.favorites.length === 0) {
      const helperDiv = document.createElement('div');
      helperDiv.className = 'dropdown-helper-text';
      helperDiv.textContent = 'Click ★ next to any repository to add it to favorites';
      this.dropdownMenu.appendChild(helperDiv);
    }
    
    this.allSources.forEach(source => {
      if (this.favorites.some(f => f.id === (source.name || source.id))) return;
      
      const fullPath = source.name || source.id;
      const pathParts = fullPath.split('/');
      const repoName = pathParts.length >= 4 ? pathParts.slice(-2).join('/') : fullPath;
      const defaultBranch = extractDefaultBranch(source);
      
      const item = this.createRepoItem(repoName, source.name || source.id, false, defaultBranch);
      this.dropdownMenu.appendChild(item);
    });
  }

  createRepoItem(name, id, isFavorite, defaultBranch = '') {
    const item = document.createElement('div');
    item.className = 'dropdown-item-with-star';
    if (id === this.selectedSourceId) item.classList.add('selected');
    
    // Store data attributes for event delegation
    item.dataset.id = id;
    item.dataset.name = name;
    item.dataset.isFavorite = isFavorite.toString();
    if (defaultBranch) {
        item.dataset.defaultBranch = defaultBranch;
    }

    const star = document.createElement('span');
    star.className = 'icon icon-inline star-icon';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = 'star';
    star.dataset.favorited = isFavorite.toString();
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = name;
    
    item.appendChild(star);
    item.appendChild(nameSpan);
    
    return item;
  }

  async verifyDefaultBranch(favorite, updateUI = false) {
    try {
      const user = getCurrentUser();
      const { listJulesSources, getDecryptedJulesKey } = await import('./jules-api.js');
      const apiKey = await getDecryptedJulesKey(user.uid);
      
      if (!apiKey) return favorite.branch || 'master';
      
      if (!this.sourcesCache) {
        let allSources = [];
        let pageToken = null;
        do {
          const response = await listJulesSources(apiKey, pageToken);
          if (response.sources) allSources.push(...response.sources);
          pageToken = response.nextPageToken;
        } while (pageToken);
        this.sourcesCache = { sources: allSources };
      }
      
      const favoriteIdToMatch = favorite.id.replace(/^sources\//, '');
      const matchingSource = this.sourcesCache.sources?.find(s => 
        (s.name || s.id) === favoriteIdToMatch
      );
      if (!matchingSource) return favorite.branch || 'master';
      
      const defaultBranch = extractDefaultBranch(matchingSource);
      
      if (favorite.branch !== defaultBranch) {
        const updatedFavorites = this.favorites.map(f => 
          f.id === favorite.id ? { ...f, branch: defaultBranch } : f
        );
        await this.saveFavorites(updatedFavorites);
        this.favorites = updatedFavorites;
        
        if (updateUI && this.selectedSourceId === favorite.id) {
          if (this.branchSelector && !this.branchSelector.dropdownBtn.disabled) {
            this.branchSelector.initialize(favorite.id, defaultBranch);
          }
          if (this.onSelect) {
            this.onSelect(favorite.id, defaultBranch, favorite.name);
          }
        }
      }
      
      return defaultBranch;
    } catch (error) {
      console.error('[RepoSelector] Failed to verify default branch:', error);
      return favorite.branch || 'master';
    }
  }

  async saveFavorites(newFavorites) {
    const user = getCurrentUser();
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: newFavorites
        }, { merge: true });
        this.favorites = newFavorites;
      }
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  async addFavorite(sourceId, name, branch) {
    const user = getCurrentUser();
    const newFavorite = { id: sourceId, name, branch };
    
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: firebase.firestore.FieldValue.arrayUnion(newFavorite)
        }, { merge: true });
        this.favorites = [...this.favorites, newFavorite];
      }
    } catch (error) {
      console.error('Failed to add favorite:', error);
    }
  }

  async removeFavorite(sourceId) {
    const user = getCurrentUser();
    const favoriteToRemove = this.favorites.find(f => f.id === sourceId);
    
    if (!favoriteToRemove) return;
    
    try {
      const db = getDb();
      if (db) {
        await db.collection('users').doc(user.uid).set({
          favoriteRepos: firebase.firestore.FieldValue.arrayRemove(favoriteToRemove)
        }, { merge: true });
        this.favorites = this.favorites.filter(f => f.id !== sourceId);
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  }
}

export class BranchSelector {
  constructor(options) {
    this.dropdownBtn = options.dropdownBtn;
    this.dropdownText = options.dropdownText;
    this.dropdownMenu = options.dropdownMenu;
    this.onSelect = options.onSelect;
    
    this.selectedBranch = null;
    this.sourceId = null;
    this.allBranchesLoaded = false;
    this.searchInput = null;
    this.searchClearBtn = null;
    this.currentSearchTerm = '';
    this.allBranches = [];
    this.cachedFuseInstance = null;

    // Bound handlers
    this.handleDropdownToggle = this.handleDropdownToggle.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleSearchClear = this.handleSearchClear.bind(this);

    this.cleanupClickOutside = null;
  }

  destroy() {
    if (this.dropdownBtn) {
      this.dropdownBtn.removeEventListener('click', this.handleDropdownToggle);
      if (this.cleanupClickOutside) {
        this.cleanupClickOutside();
        this.cleanupClickOutside = null;
      }
    }

    if (this.dropdownMenu) {
      this.dropdownMenu.removeEventListener('click', this.handleMenuClick);
    }

    if (this.searchInput) {
        this.searchInput.removeEventListener('input', this.handleSearchInput);
    }
    if (this.searchClearBtn) {
        this.searchClearBtn.removeEventListener('click', this.handleSearchClear);
    }
  }

  saveToStorage() {
    if (this.sourceId && this.selectedBranch) {
      localStorage.setItem('selectedBranchRepo', JSON.stringify({
        sourceId: this.sourceId,
        branch: this.selectedBranch
      }));
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('selectedBranchRepo');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load branch from storage:', error);
    }
    return null;
  }

  getSelectedBranch() {
    return this.selectedBranch;
  }

  initialize(sourceId, defaultBranch) {
    // Try to restore from storage if no sourceId provided
    if (!sourceId) {
      const stored = this.loadFromStorage();
      if (stored) {
        sourceId = stored.sourceId;
        defaultBranch = stored.branch;
      }
    }
    
    this.sourceId = sourceId;
    this.selectedBranch = defaultBranch;
    this.allBranchesLoaded = false;

    // Set ARIA attributes
    this.dropdownBtn.setAttribute('aria-haspopup', 'true');
    this.dropdownBtn.setAttribute('aria-expanded', 'false');
    this.dropdownMenu.setAttribute('role', 'menu');
    
    if (!sourceId) {
      this.dropdownText.textContent = 'Select repository first';
      this.dropdownBtn.disabled = true;
      this.dropdownBtn.classList.add('disabled');
      return;
    }
    
    this.dropdownText.textContent = defaultBranch || 'Select a branch...';
    this.dropdownBtn.disabled = false;
    this.dropdownBtn.classList.remove('disabled');
    
    // Save to storage
    this.saveToStorage();
    
    this.setupDropdownToggle();

    // Setup event delegation
    this.dropdownMenu.removeEventListener('click', this.handleMenuClick); // clean up existing if any
    this.dropdownMenu.addEventListener('click', this.handleMenuClick);
  }

  setupDropdownToggle() {
    this.dropdownBtn.removeEventListener('click', this.handleDropdownToggle);
    this.dropdownBtn.addEventListener('click', this.handleDropdownToggle);

    this.cleanupClickOutside = setupClickOutsideClose(this.dropdownBtn, this.dropdownMenu);
  }

  handleDropdownToggle(e) {
    e.stopPropagation();
    if (this.dropdownMenu.classList.contains('open')) {
      this.dropdownMenu.classList.remove('open');
      this.dropdownMenu.style.display = '';
      this.dropdownBtn.setAttribute('aria-expanded', 'false');
      return;
    }

    this.dropdownBtn.setAttribute('aria-expanded', 'true');

    // Position dropdown menu if it's fixed (e.g., in modals)
    const computedStyle = window.getComputedStyle(this.dropdownMenu);
    if (computedStyle.position === 'fixed') {
      const rect = this.dropdownBtn.getBoundingClientRect();
      this.dropdownMenu.style.top = `${rect.bottom + 4}px`;
      this.dropdownMenu.style.left = `${rect.left}px`;
      this.dropdownMenu.style.width = `${rect.width}px`;
    }

    this.populateDropdown();
  }

  async handleMenuClick(e) {
      const target = e.target;
      
      // Handle Show More
      if (target.closest('.dropdown-show-more')) {
          await this.handleShowMoreClick(target.closest('.dropdown-show-more'));
          return;
      }

      // Handle Search Wrapper click (prevent propagation)
      if (target.closest('.dropdown-search-wrapper')) {
          e.stopPropagation();
          return;
      }

      // Handle Branch Item Click
      const branchItem = target.closest('.dropdown-item-with-star');
      if (branchItem) {
          // If it has dataset.branch, use it.
          // Note: In createRepoItem I used dataset.id/name. Here I should use dataset.branchName
          const branchName = branchItem.dataset.branchName;
          if (branchName && branchName !== this.selectedBranch) {
              this.setSelectedBranch(branchName);
              this.dropdownMenu.classList.remove('open');
              this.dropdownMenu.style.display = '';
              this.dropdownBtn.setAttribute('aria-expanded', 'false');
          } else if (branchName === this.selectedBranch) {
               // Current branch clicked
              this.dropdownMenu.classList.remove('open');
              this.dropdownMenu.style.display = '';
              this.dropdownBtn.setAttribute('aria-expanded', 'false');
          }
      }
  }

  async handleShowMoreClick(showMoreBtn) {
      if (this.allBranchesLoaded) return;
      
      showMoreBtn.textContent = 'Loading...';
      showMoreBtn.style.pointerEvents = 'none';
      showMoreBtn.classList.remove('status-info');

      try {
        const pathParts = this.sourceId.split('/');
        const owner = pathParts[pathParts.length - 2];
        const repo = pathParts[pathParts.length - 1];

        const { getBranches } = await import('./github-api.js');
        const allBranches = await getBranches(owner, repo);

        if (!allBranches || allBranches.length === 0) {
          showMoreBtn.textContent = allBranches === null ? 'GitHub API rate limited - try later' : 'No branches found';
          showMoreBtn.classList.add('status-info');
          showMoreBtn.style.pointerEvents = 'auto';
          return;
        }

        this.allBranchesLoaded = true;
        this.allBranches = allBranches;

        // Re-populate dropdown with search input
        this.dropdownMenu.innerHTML = '';

        // Reset search
        this.currentSearchTerm = '';
        this.searchInput = null;
        this.searchClearBtn = null;
        this.cachedFuseInstance = null;

        // Add search input
        const searchElement = this.createSearchInput();
        this.dropdownMenu.appendChild(searchElement);

        // Add current branch
        this.renderBranchItem(this.selectedBranch, true);

        // Add all other branches
        allBranches.forEach(branch => {
          if (branch.name === this.selectedBranch) return;
          this.renderBranchItem(branch.name, false);
        });
      } catch (error) {
        console.error('Failed to load branches:', error);
        showMoreBtn.textContent = 'Failed to load - click to retry';
        showMoreBtn.classList.add('status-info');
        showMoreBtn.style.pointerEvents = 'auto';
      }
  }

  handleSearchInput(e) {
      const input = e.target;
      this.currentSearchTerm = input.value.toLowerCase().trim();

      // Show/hide clear button
      if (this.currentSearchTerm) {
        this.searchClearBtn.classList.remove('hidden');
      } else {
        this.searchClearBtn.classList.add('hidden');
      }

      // Re-render filtered branches
      this.filterAndRenderBranches();
  }

  handleSearchClear(e) {
      e.stopPropagation();
      this.searchInput.value = '';
      this.currentSearchTerm = '';
      this.searchClearBtn.classList.add('hidden');
      this.searchInput.focus();
      this.filterAndRenderBranches();
  }

  /**
   * Creates a search input element for the branch dropdown
   */
  createSearchInput() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-search-wrapper';
    
    const inputContainer = document.createElement('div');
    inputContainer.style.position = 'relative';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dropdown-search';
    input.placeholder = 'Search branches...';
    input.setAttribute('aria-label', 'Search branches');
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'dropdown-search-clear hidden';
    clearBtn.setAttribute('aria-label', 'Clear search');
    clearBtn.innerHTML = '<span class="icon" aria-hidden="true">close</span>';
    
    input.addEventListener('input', this.handleSearchInput);
    clearBtn.addEventListener('click', this.handleSearchClear);
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(clearBtn);
    wrapper.appendChild(inputContainer);
    
    this.searchInput = input;
    this.searchClearBtn = clearBtn;
    
    return wrapper;
  }

  /**
   * Filters branches based on current search term using Fuse.js fuzzy search
   */
  async filterBranches(branches) {
    if (!this.currentSearchTerm) return branches;
    
    // Lazy load Fuse only when actually searching
    if (!this.cachedFuseInstance) {
      const Fuse = await loadFuse();
      this.cachedFuseInstance = new Fuse(branches, {
        keys: ['name'],
        includeScore: true,
        threshold: 0.3,
        ignoreLocation: true
      });
    }
    
    const results = this.cachedFuseInstance.search(this.currentSearchTerm);
    return results.map(result => result.item);
  }

  /**
   * Re-renders branches based on current search term
   */
  async filterAndRenderBranches() {
    if (!this.dropdownMenu || !this.allBranches.length) return;
    
    // Keep the search input at the top
    const searchWrapper = this.dropdownMenu.querySelector('.dropdown-search-wrapper');
    
    // Clear everything except search
    const items = Array.from(this.dropdownMenu.children);
    items.forEach(item => {
      if (!item.classList.contains('dropdown-search-wrapper')) {
        item.remove();
      }
    });
    
    // Get filtered branches
    const filtered = await this.filterBranches(this.allBranches);
    
    if (filtered.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'dropdown-helper-text';
      noResults.textContent = 'No branches found';
      this.dropdownMenu.appendChild(noResults);
      return;
    }
    
    // Always show current branch at top if it matches
    const currentBranch = filtered.find(b => b.name === this.selectedBranch);
    if (currentBranch) {
      this.renderBranchItem(this.selectedBranch, true);
    }
    
    // Show all other matching branches
    filtered.forEach(branch => {
      if (branch.name === this.selectedBranch) return;
      this.renderBranchItem(branch.name, false);
    });
  }

  renderBranchItem(name, isSelected) {
      const item = document.createElement('div');
      item.className = 'dropdown-item-with-star';
      if (isSelected) {
          item.classList.add('selected');
      }

      item.dataset.branchName = name;
      
      const star = document.createElement('span');
      star.className = 'star-icon';
      star.style.visibility = 'hidden';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = name;
      
      item.appendChild(star);
      item.appendChild(nameSpan);
      this.dropdownMenu.appendChild(item);
  }

  populateDropdown() {
    if (!this.sourceId) {
      showToast('Please select a repository first', 'warn');
      return;
    }
    
    this.dropdownMenu.innerHTML = '';
    
    // Reset search state
    this.currentSearchTerm = '';
    this.searchInput = null;
    this.searchClearBtn = null;
    this.cachedFuseInstance = null;
    
    // Don't add search input initially, only after "Show more" is clicked
    this.cachedFuseInstance = null;
    
    // Add search input at the top if branches are loaded
    if (this.allBranchesLoaded) {
      const searchElement = this.createSearchInput();
      this.dropdownMenu.appendChild(searchElement);
    }
    
    this.renderBranchItem(this.selectedBranch, true);
    
    const showMoreBtn = document.createElement('div');
    showMoreBtn.className = 'dropdown-show-more';
    showMoreBtn.textContent = '▼ Show more branches...';
    
    this.dropdownMenu.appendChild(showMoreBtn);
    
    this.dropdownMenu.classList.add('open');
    if (this.dropdownMenu.style.display === 'none') {
      this.dropdownMenu.style.display = '';
    }
  }

  setSelectedBranch(branch) {
    this.selectedBranch = branch;
    this.dropdownText.textContent = branch;
    
    // Save to storage
    this.saveToStorage();
    
    if (this.onSelect) {
      this.onSelect(branch);
    }
  }
}
