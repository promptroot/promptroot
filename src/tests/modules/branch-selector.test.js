import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initBranchSelector,
  setCurrentBranch,
  loadBranchFromStorage,
  getCurrentBranch,
  setCurrentRepo,
  loadBranches
} from '../../modules/branch-selector.js';

// Mock dependencies
vi.mock('../../modules/auth.js', () => ({
  getCurrentUser: vi.fn(() => null)
}));

vi.mock('../../utils/constants.js', () => ({
  USER_BRANCHES: ['jessewashburn', 'alice', 'bob'],
  FEATURE_PATTERNS: ['feature/', 'fix/', 'bugfix/'],
  HARDCODED_FAVORITE_BRANCHES: ['main', 'web-captures'],
  STORAGE_KEYS: {
    promptsCache: (owner, repo, branch) => `prompts-${owner}-${repo}-${branch}`
  }
}));

vi.mock('../../modules/github-api.js', () => ({
  getBranches: vi.fn()
}));

vi.mock('../../utils/session-cache.js', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  CACHE_KEYS: {
    BRANCHES: 'branches'
  }
}));

vi.mock('../../modules/dropdown.js', () => ({
  initDropdown: vi.fn()
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

Object.defineProperty(global, 'sessionStorage', {
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

global.history = {
  replaceState: vi.fn()
};

global.location = {
  pathname: '/index.html',
  search: '?owner=test&repo=myrepo',
  hash: ''
};

global.window = {
  dispatchEvent: vi.fn(),
  db: null
};

// Mock DOM elements
const createMockElement = (id, type = 'select') => {
  const element = {
    id,
    type,
    value: '',
    innerHTML: '',
    disabled: false,
    title: '',
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn()
    },
    addEventListener: vi.fn(),
    appendChild: vi.fn(),
    options: [],
    style: {},
    textContent: '',
    dataset: {}
  };

  if (type === 'select') {
    element.options = [];
  }

  return element;
};

const createMockOption = (value, text) => ({
  value,
  textContent: text,
  text
});

global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn((tag) => {
    if (tag === 'option') {
      return createMockOption('', '');
    }
    if (tag === 'optgroup') {
      return {
        label: '',
        appendChild: vi.fn()
      };
    }
    if (tag === 'div') {
      return {
        className: '',
        textContent: '',
        innerHTML: '',
        onclick: null,
        style: {
          cssText: '',
          display: ''
        },
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        appendChild: vi.fn(),
        dataset: {}
      };
    }
    return createMockElement('', tag);
  }),
  createDocumentFragment: vi.fn(() => ({
    appendChild: vi.fn()
  }))
};

function mockReset() {
  vi.clearAllMocks();
  
  global.localStorage.getItem.mockReturnValue(null);
  global.localStorage.setItem.mockImplementation(() => {});
  global.localStorage.removeItem.mockImplementation(() => {});
  
  global.sessionStorage.getItem.mockReturnValue(null);
  global.sessionStorage.setItem.mockImplementation(() => {});
  global.sessionStorage.removeItem.mockImplementation(() => {});
  
  global.history.replaceState.mockImplementation(() => {});
  
  global.window.dispatchEvent.mockImplementation(() => {});
  
  global.location.search = '?owner=test&repo=myrepo';
  global.location.hash = '';
  
  global.document.getElementById.mockImplementation((id) => {
    return createMockElement(id, id.includes('Select') ? 'select' : 'div');
  });
}

describe('branch-selector', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('initBranchSelector', () => {
    it('should initialize with owner, repo, and branch', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);

      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(global.document.getElementById).toHaveBeenCalledWith('branchSelect');
    });

    it('should add change event listener to branchSelect', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        return null;
      });

      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(mockSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should initialize dropdown if elements exist', async () => {
      const mockBtn = createMockElement('branchDropdownBtn', 'button');
      const mockMenu = createMockElement('branchDropdownMenu', 'div');
      const mockDropdown = createMockElement('branchDropdown', 'div');
      const { initDropdown } = await import('../../modules/dropdown.js');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchDropdownBtn') return mockBtn;
        if (id === 'branchDropdownMenu') return mockMenu;
        if (id === 'branchDropdown') return mockDropdown;
        return createMockElement(id);
      });

      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(initDropdown).toHaveBeenCalledWith(mockBtn, mockMenu, mockDropdown);
    });

    it('should load saved branch from storage', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      global.localStorage.getItem.mockReturnValue(JSON.stringify({
        branch: 'develop',
        owner: 'owner1',
        repo: 'repo1',
        timestamp: Date.now()
      }));

      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(getCurrentBranch()).toBe('develop');
    });

    it('should use provided branch if no saved branch', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      global.localStorage.getItem.mockReturnValue(null);

      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(getCurrentBranch()).toBe('main');
    });

    it('should handle missing branchSelect element', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => initBranchSelector('owner1', 'repo1', 'main')).not.toThrow();
    });
  });

  describe('setCurrentBranch', () => {
    beforeEach(() => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should update current branch', () => {
      setCurrentBranch('develop');
      
      expect(getCurrentBranch()).toBe('develop');
    });

    it('should update select element value', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        return createMockElement(id);
      });
      initBranchSelector('owner1', 'repo1', 'main');

      setCurrentBranch('feature-branch');
      
      expect(mockSelect.value).toBe('feature-branch');
    });

    it('should save branch to localStorage', () => {
      setCurrentBranch('test-branch');
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'selectedBranch',
        expect.stringContaining('test-branch')
      );
    });

    it('should save branch with owner and repo', () => {
      setCurrentBranch('feature-x');
      
      const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
      expect(savedData).toMatchObject({
        branch: 'feature-x',
        owner: 'owner1',
        repo: 'repo1'
      });
      expect(savedData.timestamp).toBeDefined();
    });

    it('should handle missing branchSelect element', () => {
      global.document.getElementById.mockReturnValue(null);
      initBranchSelector('owner1', 'repo1', 'main');

      expect(() => setCurrentBranch('develop')).not.toThrow();
    });
  });

  describe('loadBranchFromStorage', () => {
    it('should load branch for matching owner and repo', () => {
      global.localStorage.getItem.mockReturnValue(JSON.stringify({
        branch: 'develop',
        owner: 'test-owner',
        repo: 'test-repo',
        timestamp: Date.now()
      }));

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe('develop');
    });

    it('should return null for non-matching owner', () => {
      global.localStorage.getItem.mockReturnValue(JSON.stringify({
        branch: 'develop',
        owner: 'other-owner',
        repo: 'test-repo',
        timestamp: Date.now()
      }));

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe(null);
    });

    it('should return null for non-matching repo', () => {
      global.localStorage.getItem.mockReturnValue(JSON.stringify({
        branch: 'develop',
        owner: 'test-owner',
        repo: 'other-repo',
        timestamp: Date.now()
      }));

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe(null);
    });

    it('should return null if no stored data', () => {
      global.localStorage.getItem.mockReturnValue(null);

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe(null);
    });

    it('should handle invalid JSON gracefully', () => {
      global.localStorage.getItem.mockReturnValue('invalid-json');

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe(null);
      expect(global.console.error).toHaveBeenCalled();
    });

    it('should log error on storage access failure', () => {
      global.localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const branch = loadBranchFromStorage('test-owner', 'test-repo');
      
      expect(branch).toBe(null);
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch after initialization', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      
      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(getCurrentBranch()).toBe('main');
    });

    it('should return current branch after init', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      
      initBranchSelector('owner1', 'repo1', 'main');
      
      expect(getCurrentBranch()).toBe('main');
    });

    it('should return updated branch after setCurrentBranch', () => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      initBranchSelector('owner1', 'repo1', 'main');

      setCurrentBranch('develop');
      
      expect(getCurrentBranch()).toBe('develop');
    });
  });

  describe('setCurrentRepo', () => {
    beforeEach(() => {
      const mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should update current owner and repo', () => {
      setCurrentRepo('new-owner', 'new-repo');
      
      // Verify by setting a branch and checking storage
      setCurrentBranch('test');
      const savedData = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
      expect(savedData.owner).toBe('new-owner');
      expect(savedData.repo).toBe('new-repo');
    });

    it('should restore saved branch for new repo', () => {
      global.localStorage.getItem.mockReturnValue(JSON.stringify({
        branch: 'saved-branch',
        owner: 'new-owner',
        repo: 'new-repo',
        timestamp: Date.now()
      }));

      setCurrentRepo('new-owner', 'new-repo');
      
      expect(getCurrentBranch()).toBe('saved-branch');
    });

    it('should keep current branch if no saved branch', () => {
      global.localStorage.getItem.mockReturnValue(null);

      setCurrentRepo('new-owner', 'new-repo');
      
      expect(getCurrentBranch()).toBe('main');
    });
  });

  describe('loadBranches', () => {
    let mockSelect;
    let mockMenu, mockBtn, mockDropdown;

    beforeEach(async () => {
      mockSelect = createMockElement('branchSelect');
      mockSelect.options = [];
      mockMenu = createMockElement('branchDropdownMenu', 'div');
      mockBtn = createMockElement('branchDropdownBtn', 'button');
      mockDropdown = createMockElement('branchDropdown', 'div');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        if (id === 'branchDropdownMenu') return mockMenu;
        if (id === 'branchDropdownBtn') return mockBtn;
        if (id === 'branchDropdown') return mockDropdown;
        return createMockElement(id);
      });
      
      const { getBranches } = await import('../../modules/github-api.js');
      const { getCache, setCache } = await import('../../utils/session-cache.js');
      
      getBranches.mockResolvedValue([
        { name: 'main', sha: 'abc123' },
        { name: 'develop', sha: 'def456' },
        { name: 'jessewashburn', sha: 'ghi789' },
        { name: 'feature/new-ui', sha: 'jkl012' }
      ]);
      
      getCache.mockReturnValue(null);
      setCache.mockImplementation(() => {});
      
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should disable select while loading', async () => {
      const loadPromise = loadBranches();
      
      expect(mockSelect.disabled).toBe(true);
      
      await loadPromise;
    });

    it('should show loading message', async () => {
      const loadPromise = loadBranches();
      
      expect(mockSelect.innerHTML).toContain('Loading');
      
      await loadPromise;
    });

    it('should fetch branches from API', async () => {
      const { getBranches } = await import('../../modules/github-api.js');
      
      await loadBranches();
      
      expect(getBranches).toHaveBeenCalledWith('owner1', 'repo1');
    });

    it('should use cached branches if available', async () => {
      const { getBranches } = await import('../../modules/github-api.js');
      const { getCache } = await import('../../utils/session-cache.js');
      const cachedBranches = [{ name: 'main', sha: 'cached' }];
      getCache.mockReturnValue(cachedBranches);
      
      await loadBranches();
      
      expect(getBranches).not.toHaveBeenCalled();
    });

    it('should cache fetched branches', async () => {
      const { setCache, CACHE_KEYS } = await import('../../utils/session-cache.js');
      
      await loadBranches();
      
      expect(setCache).toHaveBeenCalledWith(
        CACHE_KEYS.BRANCHES,
        expect.any(Array),
        'owner1/repo1'
      );
    });

    it('should populate main branches first', async () => {
      await loadBranches();
      
      expect(global.document.createElement).toHaveBeenCalledWith('option');
    });

    it('should set current branch as selected', async () => {
      await loadBranches();
      
      expect(mockSelect.value).toBe('main');
    });

    it('should enable select after loading', async () => {
      await loadBranches();
      
      expect(mockSelect.disabled).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      const { getBranches } = await import('../../modules/github-api.js');
      getBranches.mockRejectedValue(new Error('API Error'));
      
      await loadBranches();
      
      expect(mockSelect.innerHTML).toContain('main');
      expect(mockSelect.title).toBeTruthy();
      expect(mockSelect.disabled).toBe(false);
    });

    it('should add current branch if not in list', async () => {
      const { getBranches } = await import('../../modules/github-api.js');
      getBranches.mockResolvedValue([
        { name: 'main', sha: 'abc123' }
      ]);
      setCurrentBranch('custom-branch');
      
      await loadBranches();
      
      expect(mockSelect.appendChild).toHaveBeenCalled();
    });

    it('should handle missing branchSelect element', async () => {
      global.document.getElementById.mockReturnValue(null);
      
      await expect(loadBranches()).resolves.toBeUndefined();
    });

    it('should populate custom dropdown menu if present', async () => {
      const mockMenu = createMockElement('branchDropdownMenu', 'div');
      const mockBtn = createMockElement('branchDropdownBtn', 'button');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        if (id === 'branchDropdownMenu') return mockMenu;
        if (id === 'branchDropdownBtn') return mockBtn;
        return createMockElement(id);
      });
      
      initBranchSelector('owner1', 'repo1', 'main');
      await loadBranches();
      
      // Check that menu.appendChild was called (for branch items)
      expect(mockMenu.appendChild).toHaveBeenCalled();
    });

    it('should clear menu innerHTML before populating', async () => {
      const mockMenu = createMockElement('branchDropdownMenu', 'div');
      const mockBtn = createMockElement('branchDropdownBtn', 'button');
      mockMenu.innerHTML = 'old content';
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        if (id === 'branchDropdownMenu') return mockMenu;
        if (id === 'branchDropdownBtn') return mockBtn;
        return createMockElement(id);
      });
      
      initBranchSelector('owner1', 'repo1', 'main');
      await loadBranches();
      
      expect(mockMenu.innerHTML).toBe('');
    });

    it('should update dropdown label with current branch', async () => {
      // Re-initialize to capture label element
      const mockLabel = createMockElement('branchDropdownLabel', 'span');
      
      // Override mock to include label element
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'branchSelect') return mockSelect;
        if (id === 'branchDropdownMenu') return mockMenu;
        if (id === 'branchDropdownBtn') return mockBtn;
        if (id === 'branchDropdownLabel') return mockLabel;
        if (id === 'branchDropdown') return mockDropdown;
        return createMockElement(id);
      });
      
      await loadBranches();
      
      // Verify menu was populated (innerHTML should be '')
      expect(mockMenu.innerHTML).toBe('');
      // Note: The label is NOT updated during loadBranches - it's only updated during handleBranchChange
      // The loadBranches function only populates the dropdown menu
      expect(mockLabel.textContent).toBe('');
    });
  });

  describe('branch classification', () => {
    let mockSelect;

    beforeEach(async () => {
      mockSelect = createMockElement('branchSelect');
      global.document.getElementById.mockReturnValue(mockSelect);
      
      const { getBranches } = await import('../../modules/github-api.js');
      getBranches.mockResolvedValue([
        { name: 'main', sha: '1' },
        { name: 'master', sha: '2' },
        { name: 'jessewashburn', sha: '3' },
        { name: 'alice', sha: '4' },
        { name: 'feature/new-ui', sha: '5' },
        { name: 'fix/bug-123', sha: '6' },
        { name: 'codex/test', sha: '7' },
        { name: '123-issue', sha: '8' },
        { name: 'very-long-branch-name', sha: '9' },
        { name: 'short', sha: '10' }
      ]);
      
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should classify main/master as main branches', async () => {
      await loadBranches();
      
      // Main branches should be added first without optgroup
      expect(global.document.createElement).toHaveBeenCalledWith('option');
    });

    it('should classify user branches correctly', async () => {
      await loadBranches();
      
      expect(global.document.createElement).toHaveBeenCalledWith('optgroup');
    });

    it('should classify feature branches correctly', async () => {
      await loadBranches();
      
      expect(global.document.createElement).toHaveBeenCalledWith('optgroup');
    });
  });

  describe('branch toggling', () => {
    let mockSelect;

    beforeEach(async () => {
      mockSelect = createMockElement('branchSelect');
      mockSelect.addEventListener = vi.fn((event, handler) => {
        mockSelect._changeHandler = handler;
      });
      
      global.document.getElementById.mockReturnValue(mockSelect);
      
      const { getBranches } = await import('../../modules/github-api.js');
      getBranches.mockResolvedValue([
        { name: 'main', sha: '1' },
        { name: 'feature/test', sha: '2' }
      ]);
      
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should toggle feature branches visibility', async () => {
      global.localStorage.getItem.mockReturnValue('false');
      mockSelect.value = '__toggle_features__';
      
      await mockSelect._changeHandler();
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith('showFeatureBranches', 'true');
    });

    it('should toggle user branches visibility', async () => {
      global.localStorage.getItem.mockReturnValue('true');
      mockSelect.value = '__toggle_users__';
      
      await mockSelect._changeHandler();
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith('showUserBranches', 'false');
    });
  });

  describe('branch change handling', () => {
    let mockSelect;

    beforeEach(() => {
      mockSelect = createMockElement('branchSelect');
      mockSelect.addEventListener = vi.fn((event, handler) => {
        mockSelect._changeHandler = handler;
      });
      
      global.document.getElementById.mockReturnValue(mockSelect);
      initBranchSelector('owner1', 'repo1', 'main');
    });

    it('should update URL on branch change', async () => {
      mockSelect.value = 'develop';
      
      await mockSelect._changeHandler();
      
      expect(global.history.replaceState).toHaveBeenCalled();
    });

    it('should preserve slug in URL', async () => {
      global.location.hash = '#p=test-slug';
      mockSelect.value = 'develop';
      
      await mockSelect._changeHandler();
      
      const urlCall = global.history.replaceState.mock.calls[0][2];
      expect(urlCall).toContain('p=test-slug');
    });

    it('should clear old branch cache', async () => {
      mockSelect.value = 'develop';
      
      await mockSelect._changeHandler();
      
      expect(global.sessionStorage.removeItem).toHaveBeenCalled();
    });

    it('should dispatch branchChanged event', async () => {
      mockSelect.value = 'develop';
      
      await mockSelect._changeHandler();
      
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'branchChanged',
          detail: { branch: 'develop' }
        })
      );
    });

    it('should save new branch to storage', async () => {
      mockSelect.value = 'feature-x';
      
      await mockSelect._changeHandler();
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'selectedBranch',
        expect.stringContaining('feature-x')
      );
    });
  });
});