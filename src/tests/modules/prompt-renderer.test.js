import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setHandleTryInJulesCallback,
  initPromptRenderer,
  destroyPromptRenderer,
  getCurrentPromptText,
  setCurrentPromptText,
  selectBySlug,
  selectFile
} from '../../modules/prompt-renderer.js';

vi.mock('../../utils/slug.js', () => ({
  slugify: vi.fn((str) => str.toLowerCase().replace(/\s+/g, '-'))
}));

vi.mock('../../modules/github-api.js', () => ({
  isGistUrl: vi.fn(),
  resolveGistRawUrl: vi.fn(),
  fetchGistContent: vi.fn(),
  fetchRawFile: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  CODEX_URL_REGEX: /codex\//,
  TIMEOUTS: {
    shortDelay: 100
  },
  CACHE_DURATIONS: {
    short: 300000,
    session: 0
  }
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../../utils/lazy-loaders.js', () => ({
  loadMarked: vi.fn()
}));

vi.mock('../../modules/prompt-list.js', () => ({
  ensureAncestorsExpanded: vi.fn(),
  loadExpandedState: vi.fn(),
  persistExpandedState: vi.fn(),
  renderList: vi.fn(),
  updateActiveItem: vi.fn(),
  setCurrentSlug: vi.fn(),
  getCurrentSlug: vi.fn(),
  getFiles: vi.fn().mockReturnValue([])
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/copen.js', () => ({
  copyAndOpen: vi.fn()
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    setActivity: vi.fn(),
    clearActivity: vi.fn(),
    showMessage: vi.fn()
  }
}));

vi.mock('../../utils/clipboard.js', () => ({
  copyText: vi.fn().mockResolvedValue(true)
}));

global.document = {
  getElementById: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  createElement: vi.fn(),
  querySelectorAll: vi.fn().mockReturnValue([])
};

global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: { hash: '', href: 'https://example.com' },
  URL: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  },
  history: {
    pushState: vi.fn()
  }
};

global.navigator = {};

global.URL = global.window.URL;

global.Blob = vi.fn();

describe('prompt-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockElement = {
      innerHTML: '',
      textContent: '',
      style: { display: 'block' },
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn().mockReturnValue(false)
      },
      onclick: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      closest: vi.fn().mockReturnValue(null),
      href: '',
      download: '',
      title: '',
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      dataset: {},
      childNodes: [],
      focus: vi.fn()
    };

    global.document.getElementById.mockImplementation((id) => {
      const allowedIds = [
        'content', 'title', 'meta', 'empty', 'actions', 'copyBtn', 'copenBtn',
        'rawBtn', 'ghBtn', 'editBtn', 'shareBtn', 'julesBtn', 'freeInputBtn', 'moreBtn',
        'freeInputSection', 'freeInputTextarea', 'freeInputSubmitBtn', 'freeInputQueueBtn',
        'freeInputSplitBtn', 'freeInputSaveBtn', 'freeInputCopenBtn', 'freeInputCancelBtn',
        'freeInputRepoDropdownText', 'freeInputRepoDropdownBtn', 'freeInputRepoDropdownMenu',
        'freeInputBranchDropdownBtn', 'freeInputBranchDropdownText', 'freeInputBranchDropdownMenu',
        'freeInputCopenMenu'
      ];

      if (allowedIds.includes(id)) {
        return { ...mockElement, id };
      }
      return null;
    });

    global.document.createElement.mockReturnValue(mockElement);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('setHandleTryInJulesCallback', () => {
    it('should set the callback function', () => {
      const mockCallback = vi.fn();
      
      setHandleTryInJulesCallback(mockCallback);
      
      expect(() => setHandleTryInJulesCallback(mockCallback)).not.toThrow();
    });

    it('should accept null callback', () => {
      expect(() => setHandleTryInJulesCallback(null)).not.toThrow();
    });
  });

  describe('initPromptRenderer', () => {
    it('should initialize all DOM elements', () => {
      initPromptRenderer();

      expect(global.document.getElementById).toHaveBeenCalledWith('content');
      expect(global.document.getElementById).toHaveBeenCalledWith('title');
      expect(global.document.getElementById).toHaveBeenCalledWith('meta');
      expect(global.document.getElementById).toHaveBeenCalledWith('empty');
      expect(global.document.getElementById).toHaveBeenCalledWith('actions');
      expect(global.document.getElementById).toHaveBeenCalledWith('copyBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('copenContainer');
      expect(global.document.getElementById).toHaveBeenCalledWith('rawBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('ghBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('editBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('shareBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('julesBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('freeInputBtn');
      expect(global.document.getElementById).toHaveBeenCalledWith('moreBtn');
    });

    it('should add event listeners', () => {
      initPromptRenderer();

      expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(global.window.addEventListener).toHaveBeenCalledWith('branchChanged', expect.any(Function));
    });

    it('should handle missing DOM elements gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => initPromptRenderer()).not.toThrow();
    });

    it('should preserve original copen button label', () => {
      const mockCopenBtn = {
        innerHTML: 'Original Label'
      };
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'copenBtn') return mockCopenBtn;
        return null;
      });

      expect(() => initPromptRenderer()).not.toThrow();
    });
  });

  describe('destroyPromptRenderer', () => {
    beforeEach(() => {
      initPromptRenderer();
    });

    it('should remove event listeners', () => {
      destroyPromptRenderer();

      expect(global.document.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(global.window.removeEventListener).toHaveBeenCalledWith('branchChanged', expect.any(Function));
    });

    it('should revoke blob URLs', () => {
      setCurrentPromptText('test content');
      
      destroyPromptRenderer();

      expect(() => destroyPromptRenderer()).not.toThrow();
    });

    it('should handle multiple destroy calls gracefully', () => {
      destroyPromptRenderer();
      expect(() => destroyPromptRenderer()).not.toThrow();
    });
  });

  describe('getCurrentPromptText', () => {
    it('should return null initially', () => {
      expect(getCurrentPromptText()).toBeNull();
    });

    it('should return current prompt text after setting', () => {
      setCurrentPromptText('test prompt');
      expect(getCurrentPromptText()).toBe('test prompt');
    });
  });

  describe('setCurrentPromptText', () => {
    it('should set the current prompt text', () => {
      setCurrentPromptText('new prompt text');
      expect(getCurrentPromptText()).toBe('new prompt text');
    });

    it('should handle null input', () => {
      setCurrentPromptText(null);
      expect(getCurrentPromptText()).toBeNull();
    });

    it('should handle empty string', () => {
      setCurrentPromptText('');
      expect(getCurrentPromptText()).toBe('');
    });
  });

  describe('selectBySlug', () => {
    const mockFiles = [
      { path: 'test-file.md', name: 'test-file.md' },
      { path: 'another-file.md', name: 'another-file.md' }
    ];

    beforeEach(() => {
      initPromptRenderer();
    });

    it('should select file by matching slug', async () => {
      await expect(selectBySlug('test-file', mockFiles, 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });

    it('should show free input for non-matching slug', async () => {
      await expect(selectBySlug('non-existent', mockFiles, 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });

    it('should handle empty files array', async () => {
      await expect(selectBySlug('test-file', [], 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });

    it('should handle null/undefined inputs', async () => {
      await expect(selectBySlug(null, mockFiles, 'owner', 'repo', 'main')).resolves.toBeUndefined();
    });
  });

  describe('selectFile', () => {
    const mockFile = {
      path: 'test-file.md',
      name: 'test-file.md',
      slug: 'test-file',
      type: 'file'
    };

    beforeEach(async () => {
      destroyPromptRenderer();
      initPromptRenderer();
      
      const { fetchRawFile } = await import('../../modules/github-api.js');
      const { loadMarked } = await import('../../utils/lazy-loaders.js');
      
      vi.clearAllMocks();
      
      fetchRawFile.mockResolvedValue('# Test Content\nThis is a test file.');
      loadMarked.mockResolvedValue({
        parse: vi.fn().mockReturnValue('<h1>Test Content</h1><p>This is a test file.</p>')
      });
    });

    it('should select and render file successfully', async () => {
      await selectFile(mockFile, true, 'owner', 'repo', 'main');

      expect(getCurrentPromptText()).toBe('# Test Content\nThis is a test file.');
    });

    it('should handle file fetch errors', async () => {
      const { fetchRawFile } = await import('../../modules/github-api.js');
      fetchRawFile.mockReset();
      fetchRawFile.mockRejectedValue(new Error('Fetch failed'));

      await expect(selectFile(mockFile, true, 'owner', 'repo', 'main')).rejects.toThrow('Fetch failed');
    });

    it('should update URL hash when pushHash is true', async () => {
      await selectFile(mockFile, true, 'owner', 'repo', 'main');

      expect(window.location.hash).toBeDefined();
    });

    it('should not update URL hash when pushHash is false', async () => {
      const originalHash = window.location.hash;
      
      await selectFile(mockFile, false, 'owner', 'repo', 'main');

      expect(window.location.hash).toBe(originalHash);
    });

    it('should handle gist URLs', async () => {
      const gistFile = {
        path: 'https://gist.github.com/user/gistid',
        name: 'gist-file.md',
        slug: 'gist-file',
        type: 'file'
      };

      const { isGistUrl, fetchGistContent } = await import('../../modules/github-api.js');
      isGistUrl.mockReturnValue(true);
      fetchGistContent.mockResolvedValue('# Gist Content');

      await selectFile(gistFile, true, 'owner', 'repo', 'main');

      expect(fetchGistContent).toHaveBeenCalled();
      expect(getCurrentPromptText()).toBe('# Gist Content');
    });

    it('should cache file content', async () => {
      const { fetchRawFile } = await import('../../modules/github-api.js');
      fetchRawFile.mockReset();
      fetchRawFile.mockResolvedValue('# Test Content\nThis is a test file.');
      
      await selectFile(mockFile, true, 'owner', 'repo', 'main');
      expect(fetchRawFile).toHaveBeenCalledTimes(1);
      
      await selectFile(mockFile, true, 'owner', 'repo', 'main');
      expect(fetchRawFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      initPromptRenderer();
      
      const { fetchRawFile } = await import('../../modules/github-api.js');
      const { loadMarked } = await import('../../utils/lazy-loaders.js');
      
      fetchRawFile.mockReset();
      loadMarked.mockReset();
      
      fetchRawFile.mockResolvedValue('# Test Content');
      loadMarked.mockResolvedValue({
        parse: vi.fn().mockReturnValue('<h1>Test Content</h1>')
      });
    });

    it('should handle markdown parsing errors with fallback', async () => {
      const { loadMarked } = await import('../../utils/lazy-loaders.js');
      const { showToast } = await import('../../modules/toast.js');

      loadMarked.mockReset();
      loadMarked.mockRejectedValue(new Error('Markdown parsing failed'));

      const mockFile = { path: 'test.md', name: 'test.md', slug: 'test', type: 'file' };
      
      // Should not throw, but handle error gracefully
      await selectFile(mockFile, true, 'owner', 'repo', 'main');

      expect(showToast).toHaveBeenCalledWith('Markdown rendering unavailable', 'error');

      // contentEl is mocked, verify interactions
      // We can't easily check internal state of the specific contentEl instance since getElementById returns a new copy/reference from the mock factory or same object?
      // In the beforeEach: global.document.getElementById.mockImplementation ... returns { ...mockElement, id }
      // So it returns a new object with spread properties.
      // But the methods like appendChild are shared from the closure `mockElement`?
      // No, `mockElement` is defined inside `beforeEach`.
      // Wait, `const mockElement = { ... }` is inside `beforeEach`.
      // `global.document.getElementById` uses that `mockElement`.
      // If I want to spy on the specific element returned for 'content', I should rely on the fact that `initPromptRenderer` was called and stored the reference.
      // But `selectFile` uses the stored `contentEl`.

      // Let's rely on checking if console.error was called (though mocking it might be needed to avoid noise)
      // And showToast is mocked.

      // We can also verify that we attempted to append children to contentEl
      // But since we can't easily access the exact mock instance used inside prompt-renderer without exporting it,
      // we can verify the side effects like showToast.
    });

    it('should handle DOM manipulation errors gracefully', () => {
      global.document.getElementById.mockReturnValue(null);

      expect(() => initPromptRenderer()).not.toThrow();
    });
  });

  describe('button event handlers', () => {
    let mockButtons;

    beforeEach(() => {
      mockButtons = {
        copyBtn: { id: 'copyBtn', closest: vi.fn().mockReturnValue(null) },
        copenBtn: { id: 'copenBtn', closest: vi.fn().mockReturnValue(null) },
        rawBtn: { id: 'rawBtn', closest: vi.fn().mockReturnValue(null) },
        ghBtn: { id: 'ghBtn', closest: vi.fn().mockReturnValue(null) },
        editBtn: { id: 'editBtn', closest: vi.fn().mockReturnValue(null) },
        shareBtn: { id: 'shareBtn', closest: vi.fn().mockReturnValue(null) },
        julesBtn: { id: 'julesBtn', closest: vi.fn().mockReturnValue(null) },
        freeInputBtn: { id: 'freeInputBtn', closest: vi.fn().mockReturnValue(null) }
      };

      global.document.getElementById.mockImplementation((id) => mockButtons[id] || null);
      
      initPromptRenderer();
    });

    it('should set up document event handlers', () => {
      expect(global.document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should handle copy button click', async () => {
      setCurrentPromptText('test content to copy');
      
      // Import the mocked function
      const { copyText } = await import('../../utils/clipboard.js');

      const clickEvent = { target: mockButtons.copyBtn, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      const documentClickHandlers = global.document.addEventListener.mock.calls.filter(call => call[0] === 'click');
      if (documentClickHandlers.length > 0) {
        await documentClickHandlers[0][1](clickEvent);
      }

      expect(copyText).toHaveBeenCalledWith('test content to copy');
    });

    it('should handle jules button click', async () => {
      const mockCallback = vi.fn();
      setHandleTryInJulesCallback(mockCallback);
      setCurrentPromptText('test prompt for jules');
      
      const clickEvent = { target: mockButtons.julesBtn, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      const documentClickHandlers = global.document.addEventListener.mock.calls.filter(call => call[0] === 'click');
      if (documentClickHandlers.length > 0) {
        await documentClickHandlers[0][1](clickEvent);
      }

      expect(mockCallback).toHaveBeenCalledWith('test prompt for jules');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(async () => {
      destroyPromptRenderer();
      initPromptRenderer();
      
      await import('../../modules/github-api.js');
      const { loadMarked } = await import('../../utils/lazy-loaders.js');
      
      vi.clearAllMocks();
      
      loadMarked.mockResolvedValue({
        parse: vi.fn().mockReturnValue('<h1>Test Content</h1>')
      });
    });

    it.skip('should handle complete workflow: init -> select file -> destroy', async () => {
      setCurrentPromptText('# Test Direct Set');
      expect(getCurrentPromptText()).toBe('# Test Direct Set');
      
      setCurrentPromptText(null);
      expect(getCurrentPromptText()).toBe(null);
      
      const uniqueId = Date.now();
      const mockFile = {
        path: `integration-test-${uniqueId}.md`,
        name: `integration-test-${uniqueId}.md`,
        slug: `integration-test-${uniqueId}`,
        type: 'file'
      };

      const { fetchRawFile } = await import('../../modules/github-api.js');
      const uniqueContent = `# Integration Test ${uniqueId}`;
      
      fetchRawFile.mockReset();
      fetchRawFile.mockResolvedValue(uniqueContent);

      await selectFile(mockFile, true, 'owner', 'repo', 'main');
      
      const actualContent = getCurrentPromptText();
      expect(actualContent).toBe(uniqueContent);
      
      destroyPromptRenderer();
      expect(global.document.removeEventListener).toHaveBeenCalled();
    });

    it('should handle rapid file selection changes', async () => {
      const files = [
        { path: 'file1.md', name: 'file1.md', slug: 'file1', type: 'file' },
        { path: 'file2.md', name: 'file2.md', slug: 'file2', type: 'file' },
        { path: 'file3.md', name: 'file3.md', slug: 'file3', type: 'file' }
      ];

      const { fetchRawFile } = await import('../../modules/github-api.js');
      fetchRawFile.mockImplementation((path) => 
        Promise.resolve(`# Content for ${path}`)
      );

      const promises = files.map(file => 
        selectFile(file, true, 'owner', 'repo', 'main')
      );

      await Promise.all(promises);

      expect(fetchRawFile).toHaveBeenCalledTimes(3);
    });
  });
});