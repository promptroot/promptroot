import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

// Define a robust, chainable DB mock structure
const createChainableDbMock = () => {
  const mock = {
    collection: vi.fn(() => mock),
    doc: vi.fn(() => mock),
    orderBy: vi.fn(() => mock),
    limit: vi.fn(() => mock),
    get: vi.fn(() => Promise.resolve({ docs: [] })),
    delete: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
    onSnapshot: vi.fn(() => vi.fn()) // returns unsubscribe
  };
  return mock;
};

let mockDb = createChainableDbMock();

// Mock firebase-service BEFORE importing modules
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; }),
  getFunctions: vi.fn(() => null)
}));

import * as julesQueue from '../../modules/jules-queue.js';
import { getCache } from '../../utils/session-cache.js';
import * as julesQueueStore from '../../modules/jules-queue-store.js';

// Mock dependencies
vi.mock('../../utils/title.js', () => ({
  extractTitleFromPrompt: vi.fn()
}));

vi.mock('../../modules/status-bar.js', () => ({
  default: {
    show: vi.fn(),
    hide: vi.fn(),
    update: vi.fn(),
    showMessage: vi.fn(),
    setAction: vi.fn(),
    clearAction: vi.fn(),
    setProgress: vi.fn(),
    clearProgress: vi.fn(),
    clear: vi.fn()
  }
}));

vi.mock('../../utils/session-cache.js', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCache: vi.fn(),
  CACHE_KEYS: {
    QUEUE_ITEMS: 'queue-items'
  }
}));

vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: vi.fn(),
  BranchSelector: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/confirm-modal.js', () => ({
  showConfirm: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  JULES_MESSAGES: {
    SIGN_IN_REQUIRED: 'Please sign in to use Jules features',
    QUEUED: 'Added to Jules queue',
    deleted: (n) => `Deleted ${n} items`,
    QUEUE_FAILED: (msg) => `Failed to add to queue: ${msg}`,
    NOT_SIGNED_IN: 'Not signed in'
  },
  JULES_UI_TEXT: {
    SUBTASKS_BATCH: 'Subtasks Batch',
    SINGLE_PROMPT: 'Single Prompt',
    REMAINING_COUNT: (n) => `(${n} remaining)`
  },
  TIMEOUTS: {
    SHORT: 1000,
    MEDIUM: 3000,
    LONG: 5000,
    statusBar: 3000,
    actionFeedback: 2000
  },
  CACHE_KEYS: {
    QUEUE_ITEMS: 'queue-items',
    USER_PROFILE: 'user-profile'
  },
  PAGE_SIZES: {
    julesSessions: 10,
    branches: 100,
    queueItems: 100
  }
}));

vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/jules-modal.js', () => ({
  openUrlInBackground: vi.fn(),
  showSubtaskErrorModal: vi.fn()
}));

vi.mock('../../modules/jules-queue-store.js', () => ({
  getQueueCache: vi.fn(() => []),
  setQueueCache: vi.fn(),
  findQueueItem: vi.fn(),
  clearPromptViewerHandlers: vi.fn(),
  registerPromptViewerHandler: vi.fn(),
  getEditModalState: vi.fn(() => ({})),
  updateEditModalState: vi.fn(),
  resetEditModalState: vi.fn(),
  getActiveEditModal: vi.fn(),
  setActiveEditModal: vi.fn(),
  getActiveScheduleModal: vi.fn(),
  setActiveScheduleModal: vi.fn(),
  getQueueModalEscapeHandler: vi.fn(),
  setQueueModalEscapeHandler: vi.fn()
}));

// Mock DOM elements
const createMockElement = (id = '') => ({
  id,
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  removeAttribute: vi.fn(),
  style: {
    display: ''
  },
  onclick: null,
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn()
  },
  dataset: {},
  replaceChildren: vi.fn(),
  appendChild: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  focus: vi.fn(),
  value: ''
});

// Setup global window
global.window = {
  auth: mockAuth,
  db: mockDb,
  firebase: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        delete: vi.fn(() => 'DELETE_FIELD')
      }
    }
  }
};

global.firebase = global.window.firebase;

global.document = {
  getElementById: vi.fn((id) => {
    if (id === 'allQueueList') return createMockElement('allQueueList');
    return null;
  }),
  createElement: vi.fn((tag) => createMockElement(tag)),
  createTextNode: vi.fn((text) => ({ textContent: text })),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn()
  }
};

global.console = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

global.URL = {
  createObjectURL: vi.fn(() => 'mock-blob-url'),
  revokeObjectURL: vi.fn()
};

global.Blob = vi.fn((content, options) => ({
  content,
  type: options?.type || 'text/plain'
}));

function mockReset() {
  vi.clearAllMocks();
  getCache.mockReset();
  
  // Reset window
  global.window.auth = {
    currentUser: null
  };
  global.window.db = createChainableDbMock();
  global.window.firebase = global.firebase;

  // Restore implementations
  global.firebase.firestore.FieldValue.serverTimestamp.mockImplementation(() => 'TIMESTAMP');
  global.firebase.firestore.FieldValue.delete.mockImplementation(() => 'DELETE_FIELD');
  
  global.document.getElementById.mockImplementation((id) => {
    if (id === 'allQueueList') return createMockElement('allQueueList');
    return null;
  });
  global.document.createElement.mockImplementation((tag) => createMockElement(tag));
  global.document.createTextNode.mockImplementation((text) => ({ textContent: text }));
  global.document.querySelectorAll.mockReturnValue([]);
}

describe('jules-queue', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('handleQueueAction', () => {
    it('should show warning if user not signed in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = null;
      
      const result = await julesQueue.handleQueueAction({ prompt: 'test' });
      
      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Please sign in to use Jules features'),
        'warn',
        undefined
      );
    });

    it('should add item to queue if user signed in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = { uid: 'user123' };
      
      const result = await julesQueue.handleQueueAction({ prompt: 'test prompt' });
      
      expect(result).toBe(true);
      expect(showToast).toHaveBeenCalledWith('Added to Jules queue', 'success');
    });

    it('should show error toast on failure', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth.currentUser = { uid: 'user123' };
      
      // Force a rejection in the db mock
      global.window.db.add.mockRejectedValue(new Error('Network error'));

      const result = await julesQueue.handleQueueAction({ prompt: 'test' });
      
      expect(result).toBe(false);
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        'error',
        undefined
      );
    });
  });

  describe('addToJulesQueue', () => {
    it('should throw error if Firestore not initialized', async () => {
      global.window.db = null;
      await expect(julesQueue.addToJulesQueue('user123', {})).rejects.toThrow('Firestore not initialized');
    });

    it('should add item to queue collection', async () => {
      global.window.db.add.mockResolvedValue({ id: 'newDoc123' });
      
      const docId = await julesQueue.addToJulesQueue('user123', { prompt: 'test', sourceId: 'repo1' });
      
      expect(docId).toBe('newDoc123');
      expect(global.window.db.add).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test',
          sourceId: 'repo1',
          autoOpen: true,
          status: 'pending'
        })
      );
    });
  });

  describe('updateJulesQueueItem', () => {
    it('should call service update', async () => {
      await julesQueue.updateJulesQueueItem('user123', 'doc123', { status: 'done' });
      expect(global.window.db.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    });
  });

  describe('deleteFromJulesQueue', () => {
    it('should call service delete', async () => {
      await julesQueue.deleteFromJulesQueue('user123', 'doc123');
      expect(global.window.db.delete).toHaveBeenCalled();
    });
  });

  describe('listJulesQueue', () => {
    it('should return items from collection', async () => {
      const mockDocs = [
        { id: '1', data: () => ({ prompt: 'test1' }) },
        { id: '2', data: () => ({ prompt: 'test2' }) }
      ];
      global.window.db.get.mockResolvedValue({ docs: mockDocs });
      
      const result = await julesQueue.listJulesQueue('user123');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
    });
  });

  describe('renderQueueListDirectly', () => {
    it('should accept items array', () => {
      const items = [
        { id: '1', prompt: 'Test 1' },
        { id: '2', prompt: 'Test 2' }
      ];
      
      expect(() => julesQueue.renderQueueListDirectly(items)).not.toThrow();
    });

    it('should handle empty array', () => {
      expect(() => julesQueue.renderQueueListDirectly([])).not.toThrow();
    });
  });

  describe('deleteSelectedQueueItems', () => {
    let mockAuthUser;
    let mockQueueCache;

    beforeEach(async () => {
      const { getAuth } = await import('../../modules/firebase-service.js');
      const { getQueueCache: getQueueCacheMock } = await import('../../modules/jules-queue-store.js');
      const { showConfirm } = await import('../../modules/confirm-modal.js');

      mockAuthUser = { uid: 'user123' };
      getAuth.mockReturnValue({ currentUser: mockAuthUser });
      global.window.auth.currentUser = mockAuthUser;

      mockQueueCache = [
        { id: 'q1', type: 'single' },
        { id: 'q2', type: 'single' },
        { id: 's1', type: 'subtasks', remaining: [{}, {}] }
      ];
      getQueueCacheMock.mockReturnValue(mockQueueCache);
      showConfirm.mockResolvedValue(true);

      // Ensure DB mock is clean and has required methods for loadQueuePage
      global.window.db = createChainableDbMock();
    });

    it('should delete selected items and refresh UI on full success', async () => {
      const { showToast } = await import('../../modules/toast.js');

      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector === '.queue-checkbox:checked') {
          return [{ dataset: { docid: 'q1' } }, { dataset: { docid: 'q2' } }];
        }
        return [];
      });

      await julesQueue.deleteSelectedQueueItems();

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Deleted 2 items'), 'success');
      expect(global.window.db.get).toHaveBeenCalled();
    });

    it('should show warn toast and refresh UI on partial failure', async () => {
      const { showToast } = await import('../../modules/toast.js');

      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector === '.queue-checkbox:checked') {
          return [{ dataset: { docid: 'q1' } }, { dataset: { docid: 'q2' } }];
        }
        return [];
      });

      let callCount = 0;
      global.window.db.delete.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve();
        return Promise.reject(new Error('Delete failed'));
      });

      await julesQueue.deleteSelectedQueueItems();

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Deleted 1 item, but 1 failed'), 'warn');
      expect(global.window.db.get).toHaveBeenCalled();
    });

    it('should show error toast and refresh UI on full failure', async () => {
      const { showToast } = await import('../../modules/toast.js');

      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector === '.queue-checkbox:checked') return [{ dataset: { docid: 'q1' } }];
        return [];
      });

      global.window.db.delete.mockRejectedValue(new Error('Delete failed'));

      await julesQueue.deleteSelectedQueueItems();

      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Failed to delete items'), 'error');
      expect(global.window.db.get).toHaveBeenCalled();
    });

    it('should skip subtask deletion if parent queue item is selected', async () => {
      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector === '.queue-checkbox:checked') return [{ dataset: { docid: 's1' } }];
        if (selector === '.subtask-checkbox:checked') return [{ dataset: { docid: 's1', index: '0' } }];
        return [];
      });

      await julesQueue.deleteSelectedQueueItems();

      expect(global.window.db.delete).toHaveBeenCalled();
      expect(global.window.db.update).not.toHaveBeenCalled();
    });
  });

  describe('exportQueueToMarkdown', () => {
    beforeEach(() => {
      const { getQueueCache: getQueueCacheMock } = julesQueueStore;
      getQueueCacheMock.mockReturnValue([
        { id: '1', type: 'single', prompt: 'Prompt 1' },
        { id: '2', type: 'subtasks', remaining: [{ fullContent: 'Sub 1' }] }
      ]);

      global.document.querySelectorAll = vi.fn((selector) => {
        if (selector === '.queue-checkbox:checked') return [{ dataset: { docid: '1' } }];
        return [];
      });
    });

    it('should create and download a markdown file', () => {
      julesQueue.exportQueueToMarkdown();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
      const mockAnchor = global.document.createElement.results.find(r => r.value.id === 'a')?.value;
      if (mockAnchor) {
        expect(mockAnchor.click).toHaveBeenCalled();
      }
    });

    it('should show toast if no items selected', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.document.querySelectorAll.mockReturnValue([]);

      julesQueue.exportQueueToMarkdown();

      expect(showToast).toHaveBeenCalledWith('No items selected to export', 'warn');
    });
  });

  describe('modal visibility', () => {
    it('showJulesQueueModal should show modal and load data', async () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesQueueModal') return mockModal;
        if (id === 'allQueueList') return createMockElement('allQueueList');
        return null;
      });

      julesQueue.showJulesQueueModal();

      expect(mockModal.classList.add).toHaveBeenCalledWith('show');
    });

    it('hideJulesQueueModal should hide modal', () => {
      const mockModal = createMockElement('julesQueueModal');
      global.document.getElementById.mockReturnValue(mockModal);

      julesQueue.hideJulesQueueModal();

      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });
});
