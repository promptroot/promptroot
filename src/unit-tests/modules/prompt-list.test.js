import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setSelectFileCallback,
  setRepoContext,
  initPromptList,
  destroyPromptList,
  getFiles,
  getCurrentSlug,
  setCurrentSlug,
  ensureAncestorsExpanded,
  loadExpandedState,
  persistExpandedState,
  toggleDirectory,
  updateActiveItem,
  renderList,
  loadList
} from '../../modules/prompt-list.js';

// Mock dependencies
vi.mock('../utils/slug.js', () => ({
  slugify: vi.fn((path) => path.replace(/\.md$/i, '').replace(/[/\\]/g, '-'))
}));

vi.mock('../utils/constants.js', () => ({
  STORAGE_KEYS: {
    expandedState: (owner, repo, branch) => `sidebar:expanded:${owner}/${repo}@${branch}`
  },
  TAG_DEFINITIONS: {
    'test-tag': {
      label: 'Test',
      className: 'test-class',
      keywords: ['test', 'example']
    }
  }
}));

vi.mock('../utils/debounce.js', () => ({
  debounce: vi.fn((fn) => fn) // For testing, don't debounce
}));

// Mock prompt-service
vi.mock('../../modules/prompt-service.js', () => ({
  loadPrompts: vi.fn(),
  getPromptFolder: vi.fn((branch) => branch === 'web-captures' ? 'webcaptures' : 'prompts')
}));

vi.mock('../../utils/dom-helpers.js', () => {
  const createElementFn = vi.fn((tag, className = '', textContent = '') => {
    const el = {
      tagName: tag.toUpperCase(),
      className: className || '',
      textContent: textContent || '',
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn()
      },
      style: {},
      dataset: {},
      children: [],
      innerHTML: '',
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      closest: vi.fn(),
      getAttribute: vi.fn(),
      setAttribute: vi.fn()
    };
    return el;
  });
  
  // Make createElement available globally for the module to use
  global.createElement = createElementFn;
  
  return {
    clearElement: vi.fn(),
    stopPropagation: vi.fn(),
    toggleClass: vi.fn(),
    createElement: createElementFn
  };
});

vi.mock('../../modules/folder-submenu.js', () => ({
  setContext: vi.fn(),
  toggle: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn()
}));

vi.mock('../utils/lazy-loaders.js', () => ({
  loadFuse: vi.fn()
}));

// Setup global DOM mocks
global.document = {
  getElementById: vi.fn(),
  createElement: vi.fn(),
  createTextNode: vi.fn((text) => ({ nodeType: 3, textContent: text })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.window = {
  open: vi.fn()
};


global.console = {
  error: vi.fn(),
  warn: vi.fn()
};

// Mock elements
const createMockElement = (id = null, className = null) => ({
  id,
  className: className || '',
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
    toggle: vi.fn()
  },
  style: {},
  dataset: {},
  textContent: '',
  innerHTML: '',
  children: [],
  querySelectorAll: vi.fn(() => []),
  querySelector: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  appendChild: vi.fn(),
  closest: vi.fn(),
  getAttribute: vi.fn(),
  setAttribute: vi.fn()
});

function mockReset() {
  vi.clearAllMocks();
  
  // Reset sessionStorage spy to default behavior
  global.sessionStorage.getItem.mockReturnValue(null);
  global.sessionStorage.setItem.mockImplementation(() => {}); // Reset to no-op
  global.sessionStorage.removeItem.mockImplementation(() => {});
  
  // Reset DOM mocks
  global.document.getElementById.mockImplementation((id) => {
    const elements = {
      'list': createMockElement('list'),
      'search': createMockElement('search'),
      'searchClear': createMockElement('searchClear')
    };
    return elements[id] || createMockElement(id);
  });
  
  global.document.createElement.mockImplementation((tag) => createMockElement(null, ''));
}

describe('prompt-list', () => {
  beforeEach(() => {
    mockReset();
  });

  afterEach(() => {
    destroyPromptList();
  });

  describe('setSelectFileCallback', () => {
    it('should set the file selection callback', () => {
      const mockCallback = vi.fn();
      setSelectFileCallback(mockCallback);
      expect(() => setSelectFileCallback(mockCallback)).not.toThrow();
    });

    it('should accept null callback', () => {
      expect(() => setSelectFileCallback(null)).not.toThrow();
    });
  });

  describe('setRepoContext', () => {
    it('should set repository context', async () => {
      const folderSubmenu = await import('../../modules/folder-submenu.js');
      setRepoContext('owner', 'repo', 'main');
      expect(folderSubmenu.setContext).toHaveBeenCalledWith('owner', 'repo', 'main');
    });

    it('should handle different branch names', async () => {
      const folderSubmenu = await import('../../modules/folder-submenu.js');
      setRepoContext('user', 'project', 'develop');
      expect(folderSubmenu.setContext).toHaveBeenCalledWith('user', 'project', 'develop');
    });
  });

  describe('initPromptList', () => {
    it('should initialize DOM elements and event listeners', () => {
      const mockSidebarHeader = createMockElement('sidebarHeader');
      global.document.getElementById.mockImplementation((id) => {
        const elements = {
          'list': createMockElement('list'),
          'search': createMockElement('search'),
          'searchClear': createMockElement('searchClear'),
          'sidebarHeader': mockSidebarHeader
        };
        return elements[id] || createMockElement(id);
      });

      initPromptList();
      expect(global.document.getElementById).toHaveBeenCalledWith('list');
      expect(global.document.getElementById).toHaveBeenCalledWith('search');
      expect(global.document.getElementById).toHaveBeenCalledWith('sidebarHeader');
      expect(mockSidebarHeader.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockSidebarHeader.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should handle missing DOM elements gracefully', () => {
      global.document.getElementById.mockReturnValue(null);
      expect(() => initPromptList()).not.toThrow();
    });
  });

  describe('destroyPromptList', () => {
    it('should clear state', () => {
      destroyPromptList();
      expect(getFiles()).toEqual([]);
      expect(getCurrentSlug()).toBe(null);
    });
  });

  describe('getFiles and file state management', () => {
    it('should return current files array', () => {
      const files = getFiles();
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('getCurrentSlug and setCurrentSlug', () => {
    it('should set and get current slug', () => {
      setCurrentSlug('test-slug');
      expect(getCurrentSlug()).toBe('test-slug');
    });
  });

  describe('ensureAncestorsExpanded', () => {
    beforeEach(() => {
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should expand ancestor directories', () => {
      const result = ensureAncestorsExpanded('prompts/folder/subfolder/file.md');
      expect(result).toBe(true);
    });
  });

  describe('loadExpandedState', () => {
    it('should load from sessionStorage', () => {
      loadExpandedState('owner', 'repo', 'main');
      expect(global.sessionStorage.getItem).toHaveBeenCalled();
    });
  });

  describe('toggleDirectory', () => {
    beforeEach(() => {
      loadExpandedState('owner', 'repo', 'main');
      initPromptList();
    });

    it('should toggle directory and persist', async () => {
      await toggleDirectory('prompts/folder', true);
      expect(global.sessionStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('updateActiveItem', () => {
    it('should update active class', () => {
      const mockListEl = createMockElement('list');
      const mockItem = createMockElement();
      mockItem.dataset.slug = 'active';
      mockListEl.querySelectorAll.mockReturnValue([mockItem]);
      global.document.getElementById.mockReturnValue(mockListEl);

      initPromptList();
      setCurrentSlug('active');
      updateActiveItem();
      expect(mockItem.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('renderList', () => {
    const mockFiles = [
      { type: 'file', path: 'prompts/test.md', name: 'test.md' }
    ];

    beforeEach(() => {
      initPromptList();
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should render list of files', async () => {
      const domHelpers = await import('../../utils/dom-helpers.js');
      await renderList(mockFiles, 'owner', 'repo', 'main');
      expect(domHelpers.clearElement).toHaveBeenCalled();
    });

    it('should handle empty files', async () => {
      await expect(renderList([], 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });
  });

  describe('loadList', () => {
    beforeEach(() => {
      initPromptList();
      loadExpandedState('owner', 'repo', 'main');
    });

    it('should delegate to prompt-service loadPrompts', async () => {
      const promptService = await import('../../modules/prompt-service.js');
      const mockFiles = [{ type: 'file', path: 'prompts/test.md', name: 'test.md' }];
      
      promptService.loadPrompts.mockResolvedValue(mockFiles);

      const files = await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(files).toEqual(mockFiles);
      expect(promptService.loadPrompts).toHaveBeenCalledWith('owner', 'repo', 'main', 'cache-key', expect.any(Function));
    });

    it('should render the returned files', async () => {
      const promptService = await import('../../modules/prompt-service.js');
      const domHelpers = await import('../../utils/dom-helpers.js');
      
      promptService.loadPrompts.mockResolvedValue([{ type: 'file', path: 'test.md' }]);
      
      await loadList('owner', 'repo', 'main', 'cache-key');
      
      expect(domHelpers.clearElement).toHaveBeenCalled();
    });

    it('should handle background updates', async () => {
      const promptService = await import('../../modules/prompt-service.js');
      const initialFiles = [{ type: 'file', path: 'initial.md', name: 'initial.md' }];
      const updatedFiles = [{ type: 'file', path: 'updated.md', name: 'updated.md' }];
      
      promptService.loadPrompts.mockImplementation(async (o, r, b, c, onUpdate) => {
        // simulate background update
        setTimeout(() => onUpdate(updatedFiles), 0);
        return initialFiles;
      });

      const files = await loadList('owner', 'repo', 'main', 'cache-key');
      expect(files).toEqual(initialFiles);
    });

    it('should handle errors from loadPrompts', async () => {
       const promptService = await import('../../modules/prompt-service.js');
       promptService.loadPrompts.mockRejectedValue(new Error('Fetch failed'));

       const files = await loadList('owner', 'repo', 'main', 'cache-key');
       expect(files).toEqual([]);
       // Should show error message - using global.createElement (helper mock)
       expect(global.createElement).toHaveBeenCalledWith('code', expect.any(String), expect.any(String));
    });
  });
});
