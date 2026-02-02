
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showJulesKeyModal, showJulesEnvModal, showSubtaskErrorModal } from '../../modules/jules-modal.js';
import * as toast from '../../modules/toast.js';
import * as julesKeys from '../../modules/jules-keys.js';
import * as firebaseService from '../../modules/firebase-service.js';

// Mock dependencies
vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: class {
    constructor(opts) { this.opts = opts; }
    initialize() { return Promise.resolve(); }
  },
  BranchSelector: class {
    constructor(opts) { this.opts = opts; }
    initialize() { return Promise.resolve(); }
  }
}));

vi.mock('../../modules/jules-queue.js', () => ({
  addToJulesQueue: vi.fn()
}));

vi.mock('../../modules/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../../modules/title.js', () => ({
  extractTitleFromPrompt: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/jules-keys.js', () => ({
  encryptAndStoreKey: vi.fn()
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

describe('jules-modal.js', () => {
  let modal, input, saveBtn, cancelBtn;
  let envModal, envSubmitBtn, envQueueBtn, envCancelBtn;
  let listeners = [];

  beforeEach(() => {
    // Setup DOM for Key Modal
    modal = document.createElement('div');
    modal.id = 'julesKeyModal';

    input = document.createElement('input');
    input.id = 'julesKeyInput';

    saveBtn = document.createElement('button');
    saveBtn.id = 'julesSaveBtn';

    cancelBtn = document.createElement('button');
    cancelBtn.id = 'julesCancelBtn';

    // Setup DOM for Env Modal
    envModal = document.createElement('div');
    envModal.id = 'julesEnvModal';

    envSubmitBtn = document.createElement('button');
    envSubmitBtn.id = 'julesEnvSubmitBtn';

    envQueueBtn = document.createElement('button');
    envQueueBtn.id = 'julesEnvQueueBtn';

    envCancelBtn = document.createElement('button');
    envCancelBtn.id = 'julesEnvCancelBtn';

    // Append to body
    document.body.appendChild(modal);
    document.body.appendChild(input);
    document.body.appendChild(saveBtn);
    document.body.appendChild(cancelBtn);
    document.body.appendChild(envModal);
    document.body.appendChild(envSubmitBtn);
    document.body.appendChild(envQueueBtn);
    document.body.appendChild(envCancelBtn);

    // Mock other elements required by env modal
    ['julesBranchDropdownBtn', 'julesBranchDropdownText', 'julesBranchDropdownMenu',
     'julesRepoDropdownBtn', 'julesRepoDropdownText', 'julesRepoDropdownMenu',
     'julesEnvSuppressPopupsCheckbox', 'julesEnvOpenInBackgroundCheckbox'
    ].forEach(id => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    });

    // Mock addEventListener/removeEventListener to track calls
    listeners = [];
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;

    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function(type, listener, options) {
      listeners.push({ target: this, type, listener, action: 'add' });
      return originalAdd.call(this, type, listener, options);
    });

    vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function(type, listener, options) {
      listeners.push({ target: this, type, listener, action: 'remove' });
      return originalRemove.call(this, type, listener, options);
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('showJulesKeyModal', () => {
    it('should add event listeners instead of onclick', () => {
      showJulesKeyModal();
      
      // Check that onclick is NOT set (it might be set if we haven't refactored yet, but we want to assert it SHOULD use addEventListener)
      // Since we haven't refactored yet, this test serves as a verification of the change once applied.
      // Currently, the code uses onclick. So this test will fail if I assert 'onclick' is null,
      // or if I assert addEventListener was called (which it won't be yet for these buttons).
      
      const saveListener = listeners.find(l => l.target === saveBtn && l.type === 'click' && l.action === 'add');
      const cancelListener = listeners.find(l => l.target === cancelBtn && l.type === 'click' && l.action === 'add');
      
      expect(saveListener).toBeDefined();
      expect(cancelListener).toBeDefined();
    });

    it('should remove event listeners when modal is closed via cancel', () => {
      showJulesKeyModal();
      cancelBtn.click(); // Should trigger hideJulesKeyModal

      const saveRemovals = listeners.filter(l => l.target === saveBtn && l.type === 'click' && l.action === 'remove');
      const cancelRemovals = listeners.filter(l => l.target === cancelBtn && l.type === 'click' && l.action === 'remove');

      expect(saveRemovals.length).toBeGreaterThan(0);
      expect(cancelRemovals.length).toBeGreaterThan(0);
    });

    it('should show toast warning on empty input', async () => {
        showJulesKeyModal();
        input.value = '';
        saveBtn.click();
        expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('Please enter'), 'warn');
    });

    it('should call encryptAndStoreKey on save', async () => {
        vi.spyOn(firebaseService, 'getAuth').mockReturnValue({ currentUser: { uid: '123' } });
        showJulesKeyModal();
        input.value = 'test-key';
        saveBtn.click();

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(julesKeys.encryptAndStoreKey).toHaveBeenCalledWith('test-key', '123');
        expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('saved successfully'), 'success');
    });
  });

  describe('showJulesEnvModal', () => {
    it('should add event listeners', async () => {
      await showJulesEnvModal('test prompt');
      
      const submitListener = listeners.find(l => l.target === envSubmitBtn && l.type === 'click' && l.action === 'add');
      const queueListener = listeners.find(l => l.target === envQueueBtn && l.type === 'click' && l.action === 'add');
      const cancelListener = listeners.find(l => l.target === envCancelBtn && l.type === 'click' && l.action === 'add');
      
      expect(submitListener).toBeDefined();
      expect(queueListener).toBeDefined();
      expect(cancelListener).toBeDefined();
    });

    it('should remove event listeners on cancel', async () => {
      await showJulesEnvModal('test prompt');
      envCancelBtn.click();

      const submitRemovals = listeners.filter(l => l.target === envSubmitBtn && l.type === 'click' && l.action === 'remove');
      expect(submitRemovals.length).toBeGreaterThan(0);
    });
  });

  describe('showSubtaskErrorModal', () => {
    let errorRetryBtn, errorSkipBtn, errorCancelBtn, errorCloseBtn, errorQueueBtn, errorModal;

    beforeEach(() => {
        errorModal = document.createElement('div');
        errorModal.id = 'subtaskErrorModal';
        document.body.appendChild(errorModal);

        ['errorSubtaskNumber', 'errorMessage', 'errorDetails'].forEach(id => {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        });

        errorRetryBtn = document.createElement('button');
        errorRetryBtn.id = 'subtaskErrorRetryBtn';
        document.body.appendChild(errorRetryBtn);

        errorSkipBtn = document.createElement('button');
        errorSkipBtn.id = 'subtaskErrorSkipBtn';
        document.body.appendChild(errorSkipBtn);

        errorCancelBtn = document.createElement('button');
        errorCancelBtn.id = 'subtaskErrorCancelBtn';
        document.body.appendChild(errorCancelBtn);

        errorCloseBtn = document.createElement('button');
        errorCloseBtn.id = 'errorModalClose';
        document.body.appendChild(errorCloseBtn);

        errorQueueBtn = document.createElement('button');
        errorQueueBtn.id = 'subtaskErrorQueueBtn';
        document.body.appendChild(errorQueueBtn);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'errorRetryDelayCheckbox';
        document.body.appendChild(checkbox);
    });

    it('should add and remove event listeners', async () => {
        const promise = showSubtaskErrorModal(1, 1, new Error('test'));

        // Check addition
        const retryListener = listeners.find(l => l.target === errorRetryBtn && l.type === 'click' && l.action === 'add');
        expect(retryListener).toBeDefined();

        // Trigger action
        errorCancelBtn.click();
        await promise;

        // Check removal
        const retryRemovals = listeners.filter(l => l.target === errorRetryBtn && l.type === 'click' && l.action === 'remove');
        expect(retryRemovals.length).toBeGreaterThan(0);
    });
  });
});
