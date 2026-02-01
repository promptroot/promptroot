import { describe, it, expect, beforeEach, vi } from 'vitest';

// Setup global mocks
const mockAuth = {
  currentUser: null
};

let mockDb = {
  collection: vi.fn()
};

// Mock firebase-service BEFORE importing jules-modal
// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; }),
  getFunctions: vi.fn(() => null)
}));

import {
  loadSubtaskErrorModal,
  openUrlInBackground,
  showJulesKeyModal,
  hideJulesKeyModal,
  hideJulesEnvModal,
  hideSubtaskErrorModal
} from '../../modules/jules-modal.js';

// Mock dependencies
vi.mock('../../modules/jules-keys.js', () => ({
  encryptAndStoreKey: vi.fn()
}));

vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: vi.fn(),
  BranchSelector: vi.fn()
}));

vi.mock('../../modules/jules-queue.js', () => ({
  addToJulesQueue: vi.fn()
}));

vi.mock('../../utils/title.js', () => ({
  extractTitleFromPrompt: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  RETRY_CONFIG: { maxRetries: 3 },
  TIMEOUTS: { SHORT: 1000 },
  JULES_MESSAGES: {
    SIGN_IN_REQUIRED: 'Please sign in',
    QUEUED: 'Added to queue',
    QUEUE_FAILED: (msg) => `Failed: ${msg}`
  },
  JULES_MODAL_TEXT: {
    ENTER_API_KEY: 'Please enter your Jules API key.',
    SAVING: 'Saving...',
    NOT_LOGGED_IN: 'Not logged in.',
    SAVE_BUTTON: 'Save & Continue',
    KEY_SAVED_SUCCESS: 'Jules API key saved successfully',
    SAVE_KEY_ERROR: (msg) => 'Failed to save API key: ' + msg,
    NOTE_QUEUED_MODAL: 'Queued from Try in Jules modal',
    NOTE_QUEUED_PARTIAL: 'Queued from Try in Jules flow (partial retries)',
    NOTE_QUEUED_FINAL: 'Queued from Try in Jules flow (final failure)',
    SUBTASK_PROGRESS: (current, total) => `Task ${current} of ${total}`,
    SUBTASK_ERROR_TITLE: 'Subtask Error'
  }
}));

import { JULES_MODAL_TEXT } from '../../utils/constants.js';

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

// Setup global fetch and document
global.fetch = vi.fn();
global.window = {
  auth: mockAuth,
  db: mockDb
};
global.document = {
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    insertAdjacentHTML: vi.fn()
  },
  createElement: vi.fn(() => ({
    href: '',
    target: '',
    rel: '',
    style: {},
    dispatchEvent: vi.fn()
  })),
  getElementById: vi.fn()
};

global.window = {
  auth: null,
  open: vi.fn()
};

global.console = {
  error: vi.fn(),
  log: vi.fn()
};

global.MouseEvent = vi.fn((type, options) => ({ type, ...options }));
global.setTimeout = vi.fn((fn) => {
  fn();
  return 123;
});

const createMockElement = (id = '', options = {}) => {
  const element = {
    id,
    _value: options.value || '',
    textContent: options.textContent || '',
    disabled: options.disabled || false,
    checked: options.checked || false,
    onclick: null,
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    },
    focus: vi.fn()
  };
  
  // Make value a getter that returns _value
  Object.defineProperty(element, 'value', {
    get() { return this._value; },
    set(val) { this._value = val; }
  });
  
  return element;
};

function mockReset() {
  vi.clearAllMocks();
  global.fetch.mockReset();
  global.document.getElementById.mockReturnValue(null);
  global.document.body.insertAdjacentHTML.mockClear();
  global.document.body.appendChild.mockClear();
  global.document.body.removeChild.mockClear();
  global.document.createElement.mockReturnValue({
    href: '',
    target: '',
    rel: '',
    style: {},
    dispatchEvent: vi.fn()
  });
  global.window.auth = null;
}

describe('jules-modal', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('loadSubtaskErrorModal', () => {
    it('should fetch and insert modal HTML', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('<div>Modal HTML</div>')
      });
      
      await loadSubtaskErrorModal();
      
      expect(global.fetch).toHaveBeenCalledWith('/partials/subtask-error-modal.html');
      expect(global.document.body.insertAdjacentHTML).toHaveBeenCalledWith('beforeend', '<div>Modal HTML</div>');
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: false
      });
      
      await loadSubtaskErrorModal();
      
      expect(global.document.body.insertAdjacentHTML).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await loadSubtaskErrorModal();
      
      expect(global.console.error).toHaveBeenCalledWith('Error loading subtask error modal:', expect.any(Error));
    });
  });

  describe('openUrlInBackground', () => {
    it('should call window.open with correct parameters', () => {
      openUrlInBackground('https://example.com');
      
      expect(global.window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    });

    it('should handle different URLs', () => {
      openUrlInBackground('https://test.com/path');
      
      expect(global.window.open).toHaveBeenCalledWith('https://test.com/path', '_blank', 'noopener,noreferrer');
    });
  });

  describe('showJulesKeyModal', () => {
    it('should show modal and focus input', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      
      expect(mockModal.classList.add).toHaveBeenCalledWith('show');
      expect(mockInput.value).toBe('');
      expect(mockInput.focus).toHaveBeenCalled();
    });

    it('should setup save and cancel button handlers', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      
      expect(mockSaveBtn.onclick).toBeDefined();
      expect(mockCancelBtn.onclick).toBeDefined();
    });

    it('should show warning if API key is empty', async () => {
      const { showToast } = await import('../../modules/toast.js');
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput', { value: '  ' });
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith(JULES_MODAL_TEXT.ENTER_API_KEY, 'warn');
    });

    it('should show error if user not logged in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      global.window.auth = { currentUser: null };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      mockInput.value = 'test-key-123';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith(JULES_MODAL_TEXT.NOT_LOGGED_IN, 'error');
      expect(mockSaveBtn.textContent).toBe(JULES_MODAL_TEXT.SAVE_BUTTON);
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should save API key successfully', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      const { showToast } = await import('../../modules/toast.js');
      encryptAndStoreKey.mockResolvedValue();
      
      global.window.auth = { currentUser: { uid: 'user123' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: JULES_MODAL_TEXT.SAVE_BUTTON });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      mockInput.value = 'my-api-key';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(encryptAndStoreKey).toHaveBeenCalledWith('my-api-key', 'user123');
      expect(showToast).toHaveBeenCalledWith(JULES_MODAL_TEXT.KEY_SAVED_SUCCESS, 'success');
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
      expect(mockSaveBtn.textContent).toBe(JULES_MODAL_TEXT.SAVE_BUTTON);
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should call onSave callback after successful save', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      encryptAndStoreKey.mockResolvedValue();
      
      global.window.auth = { currentUser: { uid: 'user456' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: JULES_MODAL_TEXT.SAVE_BUTTON });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      const onSaveCallback = vi.fn();
      showJulesKeyModal(onSaveCallback);
      mockInput.value = 'key';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(onSaveCallback).toHaveBeenCalled();
      expect(mockSaveBtn.textContent).toBe(JULES_MODAL_TEXT.SAVE_BUTTON);
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should handle save errors', async () => {
      const { encryptAndStoreKey } = await import('../../modules/jules-keys.js');
      const { showToast } = await import('../../modules/toast.js');
      encryptAndStoreKey.mockRejectedValue(new Error('Storage failed'));
      
      global.window.auth = { currentUser: { uid: 'user789' } };
      
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn', { textContent: JULES_MODAL_TEXT.SAVE_BUTTON });
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      mockInput.value = 'key';  // Set value after showJulesKeyModal
      
      await mockSaveBtn.onclick();
      
      expect(showToast).toHaveBeenCalledWith(JULES_MODAL_TEXT.SAVE_KEY_ERROR('Storage failed'), 'error');
      expect(mockSaveBtn.textContent).toBe(JULES_MODAL_TEXT.SAVE_BUTTON);
      expect(mockSaveBtn.disabled).toBe(false);
    });

    it('should hide modal on cancel', () => {
      const mockModal = createMockElement('julesKeyModal');
      const mockInput = createMockElement('julesKeyInput');
      const mockSaveBtn = createMockElement('julesSaveBtn');
      const mockCancelBtn = createMockElement('julesCancelBtn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'julesKeyModal') return mockModal;
        if (id === 'julesKeyInput') return mockInput;
        if (id === 'julesSaveBtn') return mockSaveBtn;
        if (id === 'julesCancelBtn') return mockCancelBtn;
        return null;
      });
      
      showJulesKeyModal();
      
      mockCancelBtn.onclick();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideJulesKeyModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('julesKeyModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      hideJulesKeyModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideJulesEnvModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('julesEnvModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      hideJulesEnvModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('hideSubtaskErrorModal', () => {
    it('should remove show class from modal', () => {
      const mockModal = createMockElement('subtaskErrorModal');
      global.document.getElementById.mockReturnValue(mockModal);
      
      hideSubtaskErrorModal();
      
      expect(mockModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });
});
