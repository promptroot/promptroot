import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

let mockDb = {
  collection: vi.fn()
};

// Mock firebase-service BEFORE importing repo-branch-selector
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

const createMockElement = (id = '') => {
  const listeners = {};

  const element = {
    id,
    tagName: 'DIV',
    textContent: '',
    disabled: false,
    value: '', // For inputs
    dataset: {},
    children: [], // For tracking children
    firstChild: null,

    // Event listener storage
    _listeners: listeners,

    addEventListener: vi.fn((event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),

    removeEventListener: vi.fn((event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),

    // Helper to trigger events
    trigger: (event, eventData = {}) => {
      if (listeners[event]) {
        listeners[event].forEach(handler => handler({
          target: element,
          stopPropagation: vi.fn(),
          preventDefault: vi.fn(),
          ...eventData
        }));
      }
    },

    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(() => false),
      toggle: vi.fn()
    },

    style: {
      display: '',
      top: '',
      left: '',
      width: '',
      position: ''
    },

    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),

    contains: vi.fn(() => false),
    getBoundingClientRect: vi.fn(() => ({
      top: 100,
      bottom: 150,
      left: 50,
      right: 250,
      width: 200
    })),

    appendChild: vi.fn((child) => {
      element.children.push(child);
      if (!element.firstChild) element.firstChild = child;
      // Also update child's parentNode if needed for closest()
      child.parentNode = element;
      return child;
    }),

    insertBefore: vi.fn((newNode, referenceNode) => {
        element.children.unshift(newNode);
        element.firstChild = newNode;
        newNode.parentNode = element;
        return newNode;
    }),

    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),

    // Mock remove
    remove: vi.fn(),

    // Mock closest (simple implementation: checks itself then assumes parent structure is known or mocked)
    closest: vi.fn((selector) => {
        // Simplified check: if selector matches class name
        if (selector.startsWith('.')) {
            const className = selector.substring(1);
            if (element.classList.contains && element.classList.contains(className)) { // wait, contains is a mock returning boolean? No, classList.contains is a mock.
                // We need to inspect calls or setup mock return.
                // But for tests, we usually rely on dataset or classList being set.
                // Let's rely on manual setup of closest return for specific tests if needed,
                // or improve this logic.
                // A better approach for tests:
                if (element.className && element.className.includes(className)) return element;
            }
        }
        return null;
    }),

    focus: vi.fn()
  };

  // setter for innerHTML to clear children
  Object.defineProperty(element, 'innerHTML', {
      set: (val) => {
          if (val === '') {
              element.children = [];
              element.firstChild = null;
          }
      },
      get: () => ''
  });

  return element;
};

// Update global document
global.document = {
  createElement: vi.fn((tag) => {
    const el = createMockElement();
    el.tagName = tag.toUpperCase();
    if (tag === 'input') {
        el.type = 'text';
    }
    return el;
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};


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

    // Helper to simulate event delegation
    const simulateMenuClick = (targetElement) => {
        // Find handler
        const clickHandler = mockMenu._listeners['click']?.[0];
        if (clickHandler) {
            clickHandler({
                target: targetElement,
                stopPropagation: vi.fn(),
                preventDefault: vi.fn()
            });
        }
    };

    describe('initialize', () => {
      it('should attach event listener to dropdownBtn', async () => {
        await repoSelector.initialize();
        expect(mockBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });

      it('should attach event listener to dropdownMenu for delegation', async () => {
        await repoSelector.initialize();
        expect(mockMenu.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });

      it('should attach document click listener for outside clicks', async () => {
        await repoSelector.initialize();
        expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });
    });

    describe('destroy', () => {
      it('should remove all event listeners', async () => {
        await repoSelector.initialize();
        
        // Setup some state that adds more listeners
        await repoSelector.populateDropdown(); // Adds children
        
        repoSelector.destroy();
        
        expect(mockBtn.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(mockMenu.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        
        // Also check if document listener is removed (via cleanup function)
        expect(global.document.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      });
    });

    describe('Event Delegation', () => {
        beforeEach(async () => {
            await repoSelector.initialize();
        });

        it('should handle repository selection via delegation', async () => {
            // Setup Repo Item
            const repoItem = createMockElement();
            repoItem.className = 'dropdown-item-with-star';
            repoItem.dataset = { id: 'repo1', name: 'Repo 1', isFavorite: 'false', defaultBranch: 'main' };
            // Mock closest to return itself
            repoItem.closest.mockImplementation((sel) => {
                if (sel === '.dropdown-item-with-star') return repoItem;
                return null;
            });

            simulateMenuClick(repoItem);

            expect(repoSelector.onSelect).toHaveBeenCalledWith('repo1', 'main', 'Repo 1');
            expect(mockMenu.classList.remove).toHaveBeenCalledWith('open');
        });

        it('should handle favorite toggle via delegation (add favorite)', async () => {
            // Setup Star
            const star = createMockElement();
            star.className = 'icon icon-inline star-icon';
            star.dataset = { favorited: 'false' };

            const repoItem = createMockElement();
            repoItem.className = 'dropdown-item-with-star';
            repoItem.dataset = { id: 'repo1', name: 'Repo 1', isFavorite: 'false' };

            // Link them (mock closest)
            star.closest.mockImplementation((sel) => {
                if (sel === '.star-icon') return star;
                if (sel === '.dropdown-item-with-star') return repoItem;
                return null;
            });

            // Mock DB for addFavorite
            const mockSet = vi.fn();
            global.window.db = {
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({
                        set: mockSet
                    }))
                }))
            };

            // Simulate click
            simulateMenuClick(star);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockSet).toHaveBeenCalled();
            expect(repoItem.remove).toHaveBeenCalled(); // Item removed after adding to favorites (UI update)
        });

        it('should handle show more button click via delegation', async () => {
            const showMoreBtn = createMockElement();
            showMoreBtn.className = 'dropdown-show-more';
            showMoreBtn.closest.mockImplementation((sel) => sel === '.dropdown-show-more' ? showMoreBtn : null);

            // Mock loading repos
             const { listJulesSources, getDecryptedJulesKey } = await import('../../modules/jules-api.js');
            getDecryptedJulesKey.mockResolvedValue('test-key');
            listJulesSources.mockResolvedValue({
                sources: [{ name: 'github.com/test/repo3' }],
                nextPageToken: null
            });

            simulateMenuClick(showMoreBtn);

            expect(showMoreBtn.textContent).toBe('Loading...');
            await new Promise(resolve => setTimeout(resolve, 0)); // wait for async
            expect(listJulesSources).toHaveBeenCalled();
        });
    });

    describe('Search Interaction', () => {
        beforeEach(async () => {
            await repoSelector.initialize();
            // Force load all repos to get search input
            repoSelector.showFavorites = false;
             const { listJulesSources, getDecryptedJulesKey } = await import('../../modules/jules-api.js');
            getDecryptedJulesKey.mockResolvedValue('test-key');
            listJulesSources.mockResolvedValue({
                sources: [{ name: 'github.com/test/repo1' }],
                nextPageToken: null
            });
            await repoSelector.populateDropdown();
        });

        it('should create search input with event listeners', () => {
            const input = repoSelector.searchInput;
            expect(input).toBeDefined();
            expect(input.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
        });

        it('should filter repositories on input', async () => {
            const input = repoSelector.searchInput;
            input.value = 'repo1';

            // Trigger input event
            input.trigger('input');

            await new Promise(resolve => setTimeout(resolve, 0)); // wait for fuse lazy load

            // Mock Fuse search result (since Fuse is mocked)
            // But we mocked Fuse class in the global mock area.
            // We need to verify that filterAndRenderRepos was called and children updated.
            // Since we mocked Fuse to return [], we expect "No repositories found" helper text.

            expect(global.document.createElement).toHaveBeenCalledWith('div');
        });
    });

    describe('Performance & Checklist Items', () => {
        it('should handle 50+ repositories correctly', async () => {
             const { listJulesSources, getDecryptedJulesKey } = await import('../../modules/jules-api.js');
             getDecryptedJulesKey.mockResolvedValue('test-key');

             // Create 50 repos - use unique names to avoid collision with default favorites
             const manyRepos = Array.from({ length: 55 }, (_, i) => ({
                 name: `github.com/performance/repo${i}`,
                 githubRepo: { defaultBranch: 'main' }
             }));

             listJulesSources.mockResolvedValue({
                 sources: manyRepos,
                 nextPageToken: null
             });

             repoSelector.showFavorites = false;
             await repoSelector.initialize();
             await repoSelector.populateDropdown();

             expect(repoSelector.allSources.length).toBe(55);
             // Verify renderAllRepos creates elements
             // We can check how many times createElement was called or appended
             // mockMenu.appendChild is called for each item + search input
             // 55 items + 1 search input wrapper = 56 calls
             // + 1 loading indicator (before clearing) = 57 calls
             expect(mockMenu.appendChild).toHaveBeenCalledTimes(57);
        });

        it('should not add duplicate event handlers when opening multiple times', async () => {
            await repoSelector.initialize();

            // Click button to open
            mockBtn.trigger('click');

            // Click button to close
            mockBtn.trigger('click');

            // Click button to open again
            mockBtn.trigger('click');

            // The dropdown toggle handler is attached once in initialize (using remove then add logic to be safe)
            // We check if 'click' listeners on mockBtn is length 1
            expect(mockBtn._listeners['click'].length).toBe(1);
        });
    });
  });

  describe('BranchSelector', () => {
    let branchSelector;
    let mockBtn, mockText, mockMenu;

    // Helper to simulate event delegation
    const simulateMenuClick = (targetElement) => {
        const clickHandler = mockMenu._listeners['click']?.[0];
        if (clickHandler) {
            clickHandler({
                target: targetElement,
                stopPropagation: vi.fn(),
                preventDefault: vi.fn()
            });
        }
    };

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

    describe('Event Delegation', () => {
        beforeEach(() => {
            branchSelector.initialize('github.com/test/repo', 'main');
        });

        it('should attach delegation listener', () => {
            expect(mockMenu.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });

        it('should select branch on click', () => {
            const branchItem = createMockElement();
            branchItem.className = 'dropdown-item-with-star';
            branchItem.dataset = { branchName: 'feature-branch' };
            branchItem.closest.mockImplementation((sel) => sel === '.dropdown-item-with-star' ? branchItem : null);

            simulateMenuClick(branchItem);

            expect(branchSelector.selectedBranch).toBe('feature-branch');
            expect(branchSelector.onSelect).toHaveBeenCalledWith('feature-branch');
        });

        it('should not re-trigger onSelect if clicking current branch', () => {
            const branchItem = createMockElement();
            branchItem.className = 'dropdown-item-with-star';
            branchItem.dataset = { branchName: 'main' }; // Current branch
            branchItem.closest.mockImplementation((sel) => sel === '.dropdown-item-with-star' ? branchItem : null);

            simulateMenuClick(branchItem);

            expect(branchSelector.onSelect).not.toHaveBeenCalled();
            expect(mockMenu.classList.remove).toHaveBeenCalledWith('open');
        });
    });

    describe('destroy', () => {
        it('should cleanup listeners', () => {
            branchSelector.initialize('github.com/test/repo', 'main');
            branchSelector.destroy();

            expect(mockBtn.removeEventListener).toHaveBeenCalled();
            expect(mockMenu.removeEventListener).toHaveBeenCalled();
            expect(global.document.removeEventListener).toHaveBeenCalled();
        });
    });
  });
});
