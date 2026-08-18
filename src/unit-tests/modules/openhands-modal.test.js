import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showOpenHandsEnvModal, hideOpenHandsEnvModal } from '../../modules/openhands-modal.js';
import * as toast from '../../modules/toast.js';
import * as openhandsKeys from '../../modules/openhands-keys.js';
import * as firebaseService from '../../modules/firebase-service.js';
import * as agenticQueue from '../../modules/agentic-queue.js';
import * as openhandsApi from '../../modules/openhands-api.js';

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

vi.mock('../../modules/agentic-queue.js', () => ({
  addToAgenticQueue: vi.fn()
}));

vi.mock('../../modules/openhands-api.js', () => ({
  callRunOpenHandsFunction: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/openhands-keys.js', () => ({
  checkOpenHandsConfig: vi.fn()
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

describe('openhands-modal.js', () => {
  let modal, submitBtn, queueBtn, cancelBtn;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();

    modal = document.createElement('div');
    modal.id = 'openhandsEnvModal';

    submitBtn = document.createElement('button');
    submitBtn.id = 'openhandsEnvSubmitBtn';

    queueBtn = document.createElement('button');
    queueBtn.id = 'openhandsEnvQueueBtn';

    cancelBtn = document.createElement('button');
    cancelBtn.id = 'openhandsEnvCancelBtn';

    document.body.appendChild(modal);
    document.body.appendChild(submitBtn);
    document.body.appendChild(queueBtn);
    document.body.appendChild(cancelBtn);

    [
      'openhandsRepoDropdownBtn', 'openhandsRepoDropdownText', 'openhandsRepoDropdownMenu',
      'openhandsBranchDropdownBtn', 'openhandsBranchDropdownText', 'openhandsBranchDropdownMenu'
    ].forEach(id => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    });

    firebaseService.getAuth.mockReturnValue({
      currentUser: { uid: 'test-user-123' }
    });

    openhandsKeys.checkOpenHandsConfig.mockResolvedValue(true);
  });

  afterEach(() => {
    hideOpenHandsEnvModal();
    document.body.innerHTML = '';
  });

  it('should show warn toast if not signed in', async () => {
    firebaseService.getAuth.mockReturnValue({ currentUser: null });

    await showOpenHandsEnvModal('test prompt');

    expect(toast.showToast).toHaveBeenCalledWith('Please sign in to use OpenHands.', 'warn');
  });

  it('should show warn toast if openhands is not configured', async () => {
    openhandsKeys.checkOpenHandsConfig.mockResolvedValue(false);

    await showOpenHandsEnvModal('test prompt');

    expect(toast.showToast).toHaveBeenCalledWith('OpenHands is not configured. Redirecting to Profile Settings...', 'warn');
  });

  it('should pre-populate repo and branch and enable buttons', async () => {
    await showOpenHandsEnvModal('test prompt', 'myowner', 'myrepo', 'feat/test');

    expect(modal.classList.contains('show')).toBe(true);
    expect(submitBtn.disabled).toBe(false);
    expect(queueBtn.disabled).toBe(false);
  });

  it('should queue prompt for openhands when queue button clicked', async () => {
    agenticQueue.addToAgenticQueue.mockResolvedValue({ id: 'doc-123' });

    await showOpenHandsEnvModal('test prompt', 'myowner', 'myrepo', 'feat/test');

    await queueBtn.click();

    expect(agenticQueue.addToAgenticQueue).toHaveBeenCalledWith('test-user-123', {
      type: 'single',
      prompt: 'test prompt',
      sourceId: 'sources/github/myowner/myrepo',
      branch: 'feat/test',
      destination: 'openhands',
      note: 'Queued for OpenHands'
    });
    expect(toast.showToast).toHaveBeenCalledWith('Prompt queued for OpenHands!', 'success');
  });
});
