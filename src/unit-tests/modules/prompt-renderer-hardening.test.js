import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initPromptRenderer, selectFile } from '../../modules/prompt-renderer.js';

// Mock dependencies
vi.mock('../../utils/slug.js', () => ({
  slugify: vi.fn((str) => str.toLowerCase().replace(/\s+/g, '-'))
}));

vi.mock('../../modules/github-api.js', () => ({
  isGistUrl: vi.fn(),
  resolveGistRawUrl: vi.fn(),
  fetchGistContent: vi.fn(),
  fetchRawFile: vi.fn().mockResolvedValue('# Test')
}));

vi.mock('../../utils/constants.js', () => ({
  CODEX_URL_REGEX: /codex\//,
  TIMEOUTS: { shortDelay: 100 },
  CACHE_DURATIONS: { short: 300000, session: 0 }
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../../utils/lazy-loaders.js', () => ({
  loadMarked: vi.fn().mockResolvedValue({
    parse: vi.fn().mockReturnValue('<p>Test content</p>')
  })
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

vi.mock('../../modules/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../modules/copen.js', () => ({ copyAndOpen: vi.fn() }));
vi.mock('../../modules/status-bar.js', () => ({
  default: { setActivity: vi.fn(), clearActivity: vi.fn(), showMessage: vi.fn() }
}));
vi.mock('../../utils/clipboard.js', () => ({ copyText: vi.fn().mockResolvedValue(true) }));
vi.mock('../../modules/split-button.js', () => ({
  initSplitButton: vi.fn(),
  destroySplitButton: vi.fn()
}));
vi.mock('../../utils/copen-config.js', () => ({
  COPEN_OPTIONS: [],
  COPEN_STORAGE_KEY: 'key',
  COPEN_DEFAULT_LABEL: 'label',
  COPEN_DEFAULT_ICON: 'icon'
}));

// Global mocks
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
  URL: { createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() },
  history: { pushState: vi.fn() }
};

global.navigator = {};
global.URL = global.window.URL;
global.Blob = vi.fn();

describe('Prompt Renderer Hardening', () => {
  let mockDOMPurify;

  beforeAll(() => {
    // Mock DOMPurify specifically for this test
    mockDOMPurify = {
      _hooks: {},
      addHook: vi.fn((hook, cb) => {
        mockDOMPurify._hooks[hook] = cb;
      }),
      sanitize: vi.fn((html) => html),
      isSupported: true
    };
    global.window.DOMPurify = mockDOMPurify;

    // Mock DOM elements
    const mockElement = {
      innerHTML: '',
      textContent: '',
      style: { display: 'block' },
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn().mockReturnValue(false),
        toggle: vi.fn()
      },
      onclick: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
      closest: vi.fn().mockReturnValue(null),
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      dataset: {},
      parentNode: { insertBefore: vi.fn() },
      previousElementSibling: null
    };

    global.document.getElementById.mockImplementation((id) => {
      return { ...mockElement, id };
    });

    global.document.createElement.mockImplementation((tag) => {
      return { ...mockElement, tagName: tag.toUpperCase() };
    });
    
    initPromptRenderer();
  });

  it('should register afterSanitizeAttributes hook on file selection', async () => {
    const mockFile = { path: 'test.md', name: 'test.md', slug: 'test', type: 'file' };
    await selectFile(mockFile, true, 'owner', 'repo', 'main');

    expect(mockDOMPurify.addHook).toHaveBeenCalledWith('afterSanitizeAttributes', expect.any(Function));
  });

  it('should force target="_blank" and rel="noopener noreferrer" on links via hook', async () => {
    const mockFile = { path: 'test.md', name: 'test.md', slug: 'test', type: 'file' };
    await selectFile(mockFile, true, 'owner', 'repo', 'main');

    const hook = mockDOMPurify._hooks['afterSanitizeAttributes'];
    expect(hook).toBeDefined();

    // Create a real-like mock element for the hook test
    const linkNode = {
      tagName: 'A',
      attributes: {},
      getAttribute: vi.fn(function(attr) { return this.attributes[attr]; }),
      setAttribute: vi.fn(function(attr, val) { this.attributes[attr] = val; }),
    };

    hook(linkNode);

    expect(linkNode.setAttribute).toHaveBeenCalledWith('target', '_blank');
    expect(linkNode.setAttribute).toHaveBeenCalledWith('rel', 'noopener noreferrer');
    expect(linkNode.attributes['target']).toBe('_blank');
    expect(linkNode.attributes['rel']).toBe('noopener noreferrer');
  });

  it('should add rel="noopener noreferrer" if target="_blank" is present on non-links', async () => {
    const mockFile = { path: 'test.md', name: 'test.md', slug: 'test', type: 'file' };
    await selectFile(mockFile, true, 'owner', 'repo', 'main');

    const hook = mockDOMPurify._hooks['afterSanitizeAttributes'];

    const divNode = {
      tagName: 'DIV',
      attributes: { 'target': '_blank' },
      getAttribute: vi.fn(function(attr) { return this.attributes[attr]; }),
      setAttribute: vi.fn(function(attr, val) { this.attributes[attr] = val; }),
    };

    hook(divNode);

    expect(divNode.setAttribute).toHaveBeenCalledWith('rel', 'noopener noreferrer');
  });

  it('should not register hook multiple times', async () => {
    // The hook was already registered in previous tests
    // This test verifies the hook count doesn't increase
    const callCountBefore = mockDOMPurify.addHook.mock.calls.length;
    
    const mockFile = { path: 'test2.md', name: 'test2.md', slug: 'test2', type: 'file' };
    await selectFile(mockFile, true, 'owner', 'repo', 'main');
    
    const callCountAfter = mockDOMPurify.addHook.mock.calls.length;
    
    // Should not have called addHook again
    expect(callCountAfter).toBe(callCountBefore);
  });
});
