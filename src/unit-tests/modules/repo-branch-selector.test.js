import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

let mockDb = {
  collection: vi.fn()
};

// Mock firebase-service BEFORE importing repo-branch-selector
// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; }),
  getFunctions: vi.fn(() => null)
}));

import { RepoSelector, BranchSelector } from '../../modules/repo-branch-selector.js';

// Mock dependencies
vi.mock('../../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../../modules/auth.js', () => ({
  getCurrentUser: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  DEFAULT_FAVORITE_REPOS: [
    { id: 'github.com/test/repo1', name: 'test/repo1', branch: 'main' },
    { id: 'github.com/test/repo2', name: 'test/repo2', branch: 'develop' }
  ]
}));

vi.mock('../../modules/jules-api.js', () => ({
  listJulesSources: vi.fn(),
  getDecryptedJulesKey: vi.fn()
}));

vi.mock('../../modules/github-api.js', () => ({
  getBranches: vi.fn()
}));

vi.mock('../../utils/lazy-loaders.js', () => ({
  loadFuse: vi.fn(() => Promise.resolve(class MockFuse {
    constructor() {}
    search() { return []; }
  }))
}));

// Setup global mocks
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  },
  writable: true
});

global.console = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

global.window = {
  auth: mockAuth,
  db: mockDb,
  getComputedStyle: vi.fn(),
  firebase: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP')
      }
    }
  }
};

global.document = {
  createElement: vi.fn((tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    dataset: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn()
    },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    style: {
      cssText: '',
      display: '',
      padding: '',
      margin: '',
      textAlign: '',
      color: '',
      fontSize: '',
      cursor: '',
      fontWeight: '',
      borderTop: '',
      pointerEvents: '',
      opacity: '',
      top: '',
      left: '',
      width: '',
      position: ''
    },
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
      toggle: vi.fn()
    },
    onclick: null,
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
    contains: vi.fn(() => false),
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn()
    },
    getBoundingClientRect: vi.fn(() => ({
      top: 100,
      bottom: 150,
      left: 50,
      right: 250,
      width: 200
    }))
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const createMockElement = (id = '') => ({
  id,
  textContent: '',
  disabled: false,
  onclick: null,
  dataset: {},
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn()
  },
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  style: {
    display: '',
    opacity: '',
    cursor: '',
    top: '',
    left: '',
    width: ''
  },
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    contains: vi.fn()
  },
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  contains: vi.fn(() => false),
  getBoundingClientRect: vi.fn(() => ({
    top: 100,
    bottom: 150,
    left: 50,
    right: 250,
    width: 200
  })),
  appendChild: vi.fn(),
  innerHTML: '',
  _closeDropdownHandler: null
});

function mockReset() {
  vi.clearAllMocks();
  
  // Reset localStorage
  global.localStorage.getItem.mockReturnValue(null);
  global.localStorage.setItem.mockImplementation(() => {});
  global.localStorage.removeItem.mockImplementation(() => {});
  
  // Reset window
  global.window.db = null;
  global.window.getComputedStyle.mockReturnValue({ position: 'absolute' });
  
  // Reset document
  global.document.addEventListener.mockImplementation(() => {});
  global.document.removeEventListener.mockImplementation(() => {});
}

describe('repo-branch-selector', () => {
  describe('RepoSelector', () => {
    let repoSelector;
    let mockBtn, mockText, mockMenu;

    beforeEach(async () => {
      mockReset();
      
      mockBtn = createMockElement('repoBtn');
      mockText = createMockElement('repoText');
      mockMenu = createMockElement('repoMenu');
      
      const { getCurrentUser } = await import('../../modules/auth.js');
      getCurrentUser.mockReturnValue({ uid: 'user123', email: 'test@example.com' });

      repoSelector = new RepoSelector({
        dropdownBtn: mockBtn,
        dropdownText: mockText,
        dropdownMenu: mockMenu,
        onSelect: vi.fn(),
        showFavorites: true
      });
    });

    describe('constructor', () => {
      it('should initialize with required options', () => {
        expect(repoSelector.dropdownBtn).toBe(mockBtn);
        expect(repoSelector.dropdownText).toBe(mockText);
        expect(repoSelector.dropdownMenu).toBe(mockMenu);
      });

      it('should set showFavorites to true by default', () => {
        expect(repoSelector.showFavorites).toBe(true);
      });

      it('should initialize empty arrays', () => {
        expect(repoSelector.favorites).toEqual([]);
        expect(repoSelector.allSources).toEqual([]);
      });

      it('should set allReposLoaded to false', () => {
        expect(repoSelector.allReposLoaded).toBe(false);
      });
    });

    describe('saveToStorage', () => {
      it('should save selected source ID to localStorage', () => {
        repoSelector.selectedSourceId = 'github.com/test/repo';
        
        repoSelector.saveToStorage();
        
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
          'selectedRepoId',
          'github.com/test/repo'
        );
      });

      it('should not save if no source ID selected', () => {
        repoSelector.selectedSourceId = null;
        
        repoSelector.saveToStorage();
        
        expect(global.localStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('loadFromStorage', () => {
      it('should load repo ID from localStorage', () => {
        global.localStorage.getItem.mockReturnValue('github.com/saved/repo');
        
        const result = repoSelector.loadFromStorage();
        
        expect(result).toBe('github.com/saved/repo');
        expect(global.localStorage.getItem).toHaveBeenCalledWith('selectedRepoId');
      });

      it('should return null if nothing stored', () => {
        global.localStorage.getItem.mockReturnValue(null);
        
        const result = repoSelector.loadFromStorage();
        
        expect(result).toBe(null);
      });

      it('should handle storage errors', () => {
        global.localStorage.getItem.mockImplementation(() => {
          throw new Error('Storage error');
        });
        
        const result = repoSelector.loadFromStorage();
        
        expect(result).toBe(null);
        expect(global.console.error).toHaveBeenCalled();
      });
    });

    describe('getSelectedSourceId', () => {
      it('should return selected source ID', () => {
        repoSelector.selectedSourceId = 'github.com/test/repo';
        
        expect(repoSelector.getSelectedSourceId()).toBe('github.com/test/repo');
      });

      it('should return null if no selection', () => {
        expect(repoSelector.getSelectedSourceId()).toBe(null);
      });
    });

    describe('initialize', () => {
      it('should disable button if user not signed in', async () => {
        const { getCurrentUser } = await import('../../modules/auth.js');
        getCurrentUser.mockReturnValue(null);
        
        await repoSelector.initialize();
        
        expect(mockBtn.disabled).toBe(true);
        expect(mockText.textContent).toBe('Please sign in first');
      });

      it('should enable button if user is signed in', async () => {
        await repoSelector.initialize();
        
        expect(mockBtn.disabled).toBe(false);
      });

      it('should load default favorites', async () => {
        await repoSelector.initialize();
        
        expect(repoSelector.favorites).toHaveLength(2);
      });

      it('should load favorites from Firestore if available', async () => {
        const mockDoc = {
          exists: true,
          data: () => ({
            favoriteRepos: [
              { id: 'custom/repo', name: 'Custom Repo', branch: 'main' }
            ]
          })
        };
        global.window.db = {
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue(mockDoc)
            }))
          }))
        };

        await repoSelector.initialize();
        
        expect(repoSelector.favorites).toHaveLength(1);
        expect(repoSelector.favorites[0].name).toBe('Custom Repo');
      });

      it('should restore saved repo from storage', async () => {
        global.localStorage.getItem.mockReturnValue('github.com/test/repo1');
        
        await repoSelector.initialize();
        
        expect(repoSelector.selectedSourceId).toBe('github.com/test/repo1');
        expect(mockText.textContent).toBe('test/repo1');
      });

      it('should show placeholder if no saved repo', async () => {
        global.localStorage.getItem.mockReturnValue(null);
        
        await repoSelector.initialize();
        
        expect(mockText.textContent).toBe('Select a repository...');
      });

      it('should call onSelect when restoring saved repo', async () => {
        global.localStorage.getItem.mockReturnValue('github.com/test/repo1');
        
        await repoSelector.initialize();
        
        expect(repoSelector.onSelect).toHaveBeenCalledWith(
          'github.com/test/repo1',
          'main',
          'test/repo1'
        );
      });

      it('should setup dropdown toggle', async () => {
        await repoSelector.initialize();
        
        expect(mockBtn.onclick).toBeDefined();
      });

      it('should handle Firestore errors gracefully', async () => {
        global.window.db = {
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn().mockRejectedValue(new Error('Firestore error'))
            }))
          }))
        };

        await repoSelector.initialize();
        
        expect(global.console.error).toHaveBeenCalled();
        expect(repoSelector.favorites).toHaveLength(2); // Falls back to defaults
      });
    });

    describe('setupDropdownToggle', () => {
      beforeEach(async () => {
        await repoSelector.initialize();
      });

      it('should toggle menu visibility on button click', async () => {
        mockMenu.style.display = 'none';
        
        await mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.classList.add).toHaveBeenCalledWith('open');
      });

      it('should close menu if already open', async () => {
        mockMenu.classList.contains.mockReturnValue(true);
        
        await mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.classList.remove).toHaveBeenCalledWith('open');
      });

      it('should position fixed dropdowns', async () => {
        global.window.getComputedStyle.mockReturnValue({ position: 'fixed' });
        mockMenu.style.display = 'none';
        
        await mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.style.top).toBe('154px'); // 150 + 4
        expect(mockMenu.style.left).toBe('50px');
        expect(mockMenu.style.width).toBe('200px');
      });

      it('should setup click-outside handler', async () => {
        await repoSelector.initialize();
        
        expect(global.document.addEventListener).toHaveBeenCalledWith(
          'click',
          expect.any(Function)
        );
      });
    });

    describe('populateDropdown', () => {
      beforeEach(async () => {
        await repoSelector.initialize();
      });

      it('should show loading indicator', async () => {
        const populatePromise = repoSelector.populateDropdown();
        
        expect(mockMenu.appendChild).toHaveBeenCalled();
        expect(mockMenu.classList.add).toHaveBeenCalledWith('open');
        
        await populatePromise;
      });

      it('should render favorites by default', async () => {
        await repoSelector.populateDropdown();
        
        expect(global.document.createElement).toHaveBeenCalledWith('div');
      });

      it('should load all repos if no favorites', async () => {
        repoSelector.showFavorites = false;
        const { listJulesSources, getDecryptedJulesKey } = await import('../../modules/jules-api.js');
        getDecryptedJulesKey.mockResolvedValue('test-key');
        listJulesSources.mockResolvedValue({
          sources: [{ name: 'github.com/test/repo1' }],
          nextPageToken: null
        });
        
        await repoSelector.populateDropdown();
        
        expect(listJulesSources).toHaveBeenCalled();
      });
    });

    describe('loadAllRepos', () => {
      beforeEach(async () => {
        const { getDecryptedJulesKey, listJulesSources } = await import('../../modules/jules-api.js');
        getDecryptedJulesKey.mockResolvedValue('test-api-key');
        listJulesSources.mockResolvedValue({
          sources: [
            { name: 'github.com/org/repo1', githubRepo: { defaultBranch: 'main' } },
            { name: 'github.com/org/repo2', githubRepo: { defaultBranch: 'develop' } }
          ],
          nextPageToken: null
        });
        
        await repoSelector.initialize();
      });

      it('should fetch sources from Jules API', async () => {
        const { listJulesSources } = await import('../../modules/jules-api.js');
        
        await repoSelector.loadAllRepos();
        
        expect(listJulesSources).toHaveBeenCalledWith('test-api-key');
      });

      it('should store fetched sources', async () => {
        await repoSelector.loadAllRepos();
        
        expect(repoSelector.allSources).toHaveLength(2);
      });

      it('should handle pagination', async () => {
        const { listJulesSources } = await import('../../modules/jules-api.js');
        listJulesSources
          .mockResolvedValueOnce({
            sources: [{ name: 'repo1' }],
            nextPageToken: 'token123'
          })
          .mockResolvedValueOnce({
            sources: [{ name: 'repo2' }],
            nextPageToken: null
          });
        
        await repoSelector.loadAllRepos();
        
        expect(listJulesSources).toHaveBeenCalledTimes(2);
        expect(repoSelector.allSources).toHaveLength(2);
      });

      it('should throw error if no API key', async () => {
        const { getDecryptedJulesKey } = await import('../../modules/jules-api.js');
        getDecryptedJulesKey.mockResolvedValue(null);
        
        await expect(repoSelector.loadAllRepos()).rejects.toThrow('No API key configured');
      });

      it('should throw error if no repositories found', async () => {
        const { listJulesSources } = await import('../../modules/jules-api.js');
        listJulesSources.mockResolvedValue({ sources: [], nextPageToken: null });
        
        await expect(repoSelector.loadAllRepos()).rejects.toThrow('No repositories found');
      });
    });
  });

  describe('BranchSelector', () => {
    let branchSelector;
    let mockBtn, mockText, mockMenu;

    beforeEach(() => {
      mockReset();
      
      mockBtn = createMockElement('branchBtn');
      mockText = createMockElement('branchText');
      mockMenu = createMockElement('branchMenu');

      branchSelector = new BranchSelector({
        dropdownBtn: mockBtn,
        dropdownText: mockText,
        dropdownMenu: mockMenu,
        onSelect: vi.fn()
      });
    });

    describe('constructor', () => {
      it('should initialize with required options', () => {
        expect(branchSelector.dropdownBtn).toBe(mockBtn);
        expect(branchSelector.dropdownText).toBe(mockText);
        expect(branchSelector.dropdownMenu).toBe(mockMenu);
      });

      it('should initialize with null branch and sourceId', () => {
        expect(branchSelector.selectedBranch).toBe(null);
        expect(branchSelector.sourceId).toBe(null);
      });

      it('should set allBranchesLoaded to false', () => {
        expect(branchSelector.allBranchesLoaded).toBe(false);
      });
    });

    describe('saveToStorage', () => {
      it('should save branch and source to localStorage', () => {
        branchSelector.sourceId = 'github.com/test/repo';
        branchSelector.selectedBranch = 'main';
        
        branchSelector.saveToStorage();
        
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
          'selectedBranchRepo',
          JSON.stringify({
            sourceId: 'github.com/test/repo',
            branch: 'main'
          })
        );
      });

      it('should not save if no sourceId', () => {
        branchSelector.selectedBranch = 'main';
        
        branchSelector.saveToStorage();
        
        expect(global.localStorage.setItem).not.toHaveBeenCalled();
      });

      it('should not save if no branch', () => {
        branchSelector.sourceId = 'github.com/test/repo';
        
        branchSelector.saveToStorage();
        
        expect(global.localStorage.setItem).not.toHaveBeenCalled();
      });
    });

    describe('loadFromStorage', () => {
      it('should load branch data from localStorage', () => {
        const storedData = {
          sourceId: 'github.com/test/repo',
          branch: 'develop'
        };
        global.localStorage.getItem.mockReturnValue(JSON.stringify(storedData));
        
        const result = branchSelector.loadFromStorage();
        
        expect(result).toEqual(storedData);
      });

      it('should return null if nothing stored', () => {
        global.localStorage.getItem.mockReturnValue(null);
        
        const result = branchSelector.loadFromStorage();
        
        expect(result).toBe(null);
      });

      it('should handle invalid JSON', () => {
        global.localStorage.getItem.mockReturnValue('invalid-json');
        
        const result = branchSelector.loadFromStorage();
        
        expect(result).toBe(null);
        expect(global.console.error).toHaveBeenCalled();
      });
    });

    describe('getSelectedBranch', () => {
      it('should return selected branch', () => {
        branchSelector.selectedBranch = 'main';
        
        expect(branchSelector.getSelectedBranch()).toBe('main');
      });

      it('should return null if no selection', () => {
        expect(branchSelector.getSelectedBranch()).toBe(null);
      });
    });

    describe('initialize', () => {
      it('should set sourceId and branch', () => {
        branchSelector.initialize('github.com/test/repo', 'main');
        
        expect(branchSelector.sourceId).toBe('github.com/test/repo');
        expect(branchSelector.selectedBranch).toBe('main');
      });

      it('should update dropdown text', () => {
        branchSelector.initialize('github.com/test/repo', 'develop');
        
        expect(mockText.textContent).toBe('develop');
      });

      it('should enable button', () => {
        branchSelector.initialize('github.com/test/repo', 'main');
        
        expect(mockBtn.disabled).toBe(false);
        expect(mockBtn.classList.remove).toHaveBeenCalledWith('disabled');
      });

      it('should disable button if no sourceId', () => {
        branchSelector.initialize(null, null);
        
        expect(mockBtn.disabled).toBe(true);
        expect(mockText.textContent).toBe('Select repository first');
        expect(mockBtn.classList.add).toHaveBeenCalledWith('disabled');
      });

      it('should restore from storage if no sourceId provided', () => {
        global.localStorage.getItem.mockReturnValue(JSON.stringify({
          sourceId: 'github.com/stored/repo',
          branch: 'stored-branch'
        }));
        
        branchSelector.initialize();
        
        expect(branchSelector.sourceId).toBe('github.com/stored/repo');
        expect(branchSelector.selectedBranch).toBe('stored-branch');
      });

      it('should save to storage', () => {
        branchSelector.initialize('github.com/test/repo', 'main');
        
        expect(global.localStorage.setItem).toHaveBeenCalled();
      });

      it('should setup dropdown toggle', () => {
        branchSelector.initialize('github.com/test/repo', 'main');
        
        expect(mockBtn.onclick).toBeDefined();
      });

      it('should reset allBranchesLoaded flag', () => {
        branchSelector.allBranchesLoaded = true;
        
        branchSelector.initialize('github.com/test/repo', 'main');
        
        expect(branchSelector.allBranchesLoaded).toBe(false);
      });
    });

    describe('setupDropdownToggle', () => {
      beforeEach(() => {
        branchSelector.initialize('github.com/test/repo', 'main');
      });

      it('should toggle menu visibility', () => {
        mockMenu.style.display = 'none';
        
        mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.classList.add).toHaveBeenCalledWith('open');
      });

      it('should close menu if already open', () => {
        mockMenu.classList.contains.mockReturnValue(true);
        
        mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.classList.remove).toHaveBeenCalledWith('open');
      });

      it('should position fixed dropdowns', () => {
        global.window.getComputedStyle.mockReturnValue({ position: 'fixed' });
        mockMenu.style.display = 'none';
        
        mockBtn.onclick({ stopPropagation: vi.fn() });
        
        expect(mockMenu.style.top).toBe('154px');
        expect(mockMenu.style.left).toBe('50px');
        expect(mockMenu.style.width).toBe('200px');
      });
    });

    describe('populateDropdown', () => {
      beforeEach(() => {
        branchSelector.initialize('github.com/test/repo', 'main');
      });

      it('should show toast if no sourceId', async () => {
        const { showToast } = await import('../../modules/toast.js');
        branchSelector.sourceId = null;
        
        branchSelector.populateDropdown();
        
        expect(showToast).toHaveBeenCalledWith(
          'Please select a repository first',
          'warn'
        );
      });

      it('should show current branch as selected', () => {
        branchSelector.populateDropdown();
        
        expect(global.document.createElement).toHaveBeenCalledWith('div');
      });

      it('should add show more button', () => {
        branchSelector.populateDropdown();
        
        expect(mockMenu.appendChild).toHaveBeenCalled();
      });

      it('should display menu', () => {
        branchSelector.populateDropdown();
        
        expect(mockMenu.classList.add).toHaveBeenCalledWith('open');
      });
    });

    describe('setSelectedBranch', () => {
      beforeEach(() => {
        branchSelector.initialize('github.com/test/repo', 'main');
      });

      it('should update selected branch', () => {
        branchSelector.setSelectedBranch('develop');
        
        expect(branchSelector.selectedBranch).toBe('develop');
      });

      it('should update dropdown text', () => {
        branchSelector.setSelectedBranch('feature-branch');
        
        expect(mockText.textContent).toBe('feature-branch');
      });

      it('should save to storage', () => {
        branchSelector.setSelectedBranch('develop');
        
        expect(global.localStorage.setItem).toHaveBeenCalled();
      });

      it('should call onSelect callback', () => {
        branchSelector.setSelectedBranch('develop');
        
        expect(branchSelector.onSelect).toHaveBeenCalledWith('develop');
      });
    });
  });
});