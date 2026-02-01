import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

let mockDb = {
  collection: vi.fn()
};

// Mock firebase-service
vi.mock('../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; }),
  getFunctions: vi.fn(() => null)
}));

import { RepoSelector, BranchSelector } from '../modules/repo-branch-selector.js';

// Mock dependencies
vi.mock('../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../modules/auth.js', () => ({
  getCurrentUser: vi.fn()
}));

vi.mock('../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../utils/constants.js', () => ({
  DEFAULT_FAVORITE_REPOS: []
}));

vi.mock('../modules/jules-api.js', () => ({
  listJulesSources: vi.fn(),
  getDecryptedJulesKey: vi.fn()
}));

vi.mock('../modules/github-api.js', () => ({
  getBranches: vi.fn()
}));

vi.mock('../utils/lazy-loaders.js', () => ({
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
  getComputedStyle: vi.fn(() => ({ position: 'static' })),
  firebase: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP')
      }
    }
  }
};

const createMockElement = (id = '') => {
  const classList = new Set();
  const style = {
    setProperty: vi.fn(),
    display: '', // We want to track this
  };

  return {
    id,
    textContent: '',
    disabled: false,
    onclick: null,
    dataset: {},
    classList: {
      add: vi.fn((cls) => classList.add(cls)),
      remove: vi.fn((cls) => classList.delete(cls)),
      contains: vi.fn((cls) => classList.has(cls)),
      toggle: vi.fn((cls) => {
        if (classList.has(cls)) classList.delete(cls);
        else classList.add(cls);
      })
    },
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    style,
    appendChild: vi.fn(),
    innerHTML: '',
    contains: vi.fn(() => false),
    getBoundingClientRect: vi.fn(() => ({
      top: 100,
      bottom: 150,
      left: 50,
      right: 250,
      width: 200
    })),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => [])
  };
};

global.document = {
  createElement: vi.fn((tag) => createMockElement(tag)),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

describe('Dropdown Refactor Tests', () => {
  let repoSelector;
  let mockBtn, mockText, mockMenu;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set default computed style
    global.window.getComputedStyle.mockReturnValue({ position: 'static' });

    mockBtn = createMockElement('repoBtn');
    mockText = createMockElement('repoText');
    mockMenu = createMockElement('repoMenu');

    const { getCurrentUser } = await import('../modules/auth.js');
    getCurrentUser.mockReturnValue({ uid: 'user123', email: 'test@example.com' });

    // Mock API
    const { getDecryptedJulesKey, listJulesSources } = await import('../modules/jules-api.js');
    getDecryptedJulesKey.mockResolvedValue('mock-api-key');
    listJulesSources.mockResolvedValue({ sources: [{ name: 'repo1' }], nextPageToken: null });

    repoSelector = new RepoSelector({
      dropdownBtn: mockBtn,
      dropdownText: mockText,
      dropdownMenu: mockMenu,
      onSelect: vi.fn(),
      showFavorites: true
    });

    await repoSelector.initialize();
  });

  it('should toggle .dropdown-menu--open class instead of modifying display', async () => {
    // Initial state: not open
    expect(mockMenu.classList.contains('dropdown-menu--open')).toBe(false);

    // Click to open
    await mockBtn.onclick({ stopPropagation: vi.fn() });

    expect(mockMenu.classList.contains('dropdown-menu--open')).toBe(true);
    // Ensure display style is NOT set (it should remain default/empty in our mock if untouched)
    // Note: createMockElement initally has display: ''
    expect(mockMenu.style.display).toBe('');

    // Set open manually to simulate state for closing
    mockMenu.classList.add('open'); // Existing logic uses this check

    // Click to close
    await mockBtn.onclick({ stopPropagation: vi.fn() });

    expect(mockMenu.classList.contains('dropdown-menu--open')).toBe(false);
  });

  it('should use CSS variables for positioning when fixed', async () => {
    global.window.getComputedStyle.mockReturnValue({ position: 'fixed' });

    // Click to open
    await mockBtn.onclick({ stopPropagation: vi.fn() });

    expect(mockMenu.style.setProperty).toHaveBeenCalledWith('--dropdown-top', '154px');
    expect(mockMenu.style.setProperty).toHaveBeenCalledWith('--dropdown-left', '50px');
    expect(mockMenu.style.setProperty).toHaveBeenCalledWith('--dropdown-width', '200px');
    expect(mockMenu.classList.contains('dropdown-menu--positioned')).toBe(true);
  });

  it('should remove positioning classes when closed', async () => {
    mockMenu.classList.add('open');
    mockMenu.classList.add('dropdown-menu--open');
    mockMenu.classList.add('dropdown-menu--positioned');

    await mockBtn.onclick({ stopPropagation: vi.fn() });

    expect(mockMenu.classList.contains('dropdown-menu--positioned')).toBe(false);
    expect(mockMenu.classList.contains('dropdown-menu--open')).toBe(false);
  });
});
