import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn(() => vi.fn())
};

// Mock firebase-service
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => mockAuth)
}));

// Mock auth.js (static import)
vi.mock('../../modules/auth.js', () => ({
  getCurrentUser: vi.fn(() => mockAuth.currentUser),
  signInWithGitHub: vi.fn()
}));

// Mock dynamic imports
// Since Vitest mocks modules, we can mock the modules being dynamically imported
// and they should resolve to the mock.
// However, dynamic imports are trickier if we rely on `vi.mock` for paths not yet imported.
// But let's try standard `vi.mock` for all dependencies.

vi.mock('../../modules/jules-keys.js', () => ({
  checkJulesKey: vi.fn()
}));

vi.mock('../../modules/jules-modal.js', () => ({
  showJulesKeyModal: vi.fn(),
  openUrlInBackground: vi.fn(),
  showSubtaskErrorModal: vi.fn()
}));

vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/jules-queue.js', () => ({
  handleQueueAction: vi.fn(),
  addToJulesQueue: vi.fn()
}));

vi.mock('../../modules/jules-subtask-modal.js', () => ({
  showSubtaskSplitModal: vi.fn()
}));

vi.mock('../../modules/branch-selector.js', () => ({
  getCurrentRepo: vi.fn(),
  getCurrentBranch: vi.fn()
}));

vi.mock('../../modules/repo-branch-selector.js', () => ({
  RepoSelector: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue()
  })),
  BranchSelector: vi.fn().mockImplementation(() => ({
    initialize: vi.fn()
  }))
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/copen.js', () => ({
  copyAndOpen: vi.fn(),
  clearCopenCache: vi.fn()
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  JULES_MESSAGES: {},
  TIMEOUTS: { uiDelay: 0, longDelay: 0 },
  RETRY_CONFIG: { maxRetries: 1, baseDelay: 0 }
}));

vi.mock('../../modules/split-button.js', () => ({
  initSplitButton: vi.fn().mockReturnValue({}),
  updateSplitButtonOptions: vi.fn()
}));

vi.mock('../../utils/copen-config.js', () => ({
  getCopenOptions: vi.fn().mockResolvedValue([]),
  COPEN_STORAGE_KEY: 'mock-key',
  COPEN_DEFAULT_LABEL: 'Open',
  COPEN_DEFAULT_ICON: 'icon'
}));

import { showFreeInputModal } from '../../modules/jules-free-input.js';
import * as julesKeysModule from '../../modules/jules-keys.js';
import * as julesModalModule from '../../modules/jules-modal.js';
import * as domHelpers from '../../utils/dom-helpers.js';
import * as authModule from '../../modules/auth.js';

describe('jules-free-input', () => {
  let mockElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;

    // Mock DOM elements
    mockElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
      },
      value: '',
      focus: vi.fn(),
      addEventListener: vi.fn(),
      disabled: false,
      style: {},
      querySelector: vi.fn()
    };

    global.document.getElementById = vi.fn((id) => {
      const ids = [
        'freeInputSection', 'empty', 'title', 'meta', 'actions', 'content',
        'freeInputTextarea', 'freeInputSubmitBtn', 'freeInputQueueBtn',
        'freeInputSplitBtn', 'freeInputSaveBtn', 'freeInputCancelBtn',
        'freeInputCopenContainer', 'freeInputSuppressPopupsCheckbox',
        'freeInputOpenInBackgroundCheckbox', 'freeInputRepoDropdownText',
        'freeInputRepoDropdownBtn', 'freeInputRepoDropdownMenu',
        'freeInputBranchDropdownBtn', 'freeInputBranchDropdownText',
        'freeInputBranchDropdownMenu'
      ];
      if (ids.includes(id)) {
        return { ...mockElement, id };
      }
      return null;
    });

    global.window.open = vi.fn();

    // Mock dynamic import functionality if needed, but vi.mock usually handles it
  });

  describe('showFreeInputModal', () => {
    it('should prompt login if user is not authenticated', async () => {
      mockAuth.currentUser = null;

      showFreeInputModal();

      // Wait for async operations (dynamic import and execution)
      await new Promise(resolve => setTimeout(resolve, 50));

      // We expect signInWithGitHub to be called
      // Since it's dynamically imported, we check if the mocked module function was called
      // Wait, we mocked '../../modules/auth.js' statically.
      // Dynamic import `import('./auth.js')` inside `jules-free-input.js` (which is in `src/modules/`)
      // should resolve to the same module we mocked.

      // However, we need to make sure the mocked function is exposed correctly.
      // In our mock factory for auth.js: `signInWithGitHub: vi.fn()`

      // Let's check.
      const authModule = await import('../../modules/auth.js');
      expect(authModule.signInWithGitHub).toHaveBeenCalled();
    });

    it('should show key modal if user has no key', async () => {
      mockAuth.currentUser = { uid: 'test-uid' };
      julesKeysModule.checkJulesKey.mockResolvedValue(false);

      showFreeInputModal();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(julesKeysModule.checkJulesKey).toHaveBeenCalledWith('test-uid');

      // Expect showJulesKeyModal to be called
      expect(julesModalModule.showJulesKeyModal).toHaveBeenCalled();
    });

    it('should show free input form if user has key', async () => {
      mockAuth.currentUser = { uid: 'test-uid' };
      julesKeysModule.checkJulesKey.mockResolvedValue(true);

      showFreeInputModal();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(julesKeysModule.checkJulesKey).toHaveBeenCalledWith('test-uid');

      // Expect toggleVisibility to be called for freeInputSection
      expect(domHelpers.toggleVisibility).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'freeInputSection' }),
        true
      );
    });
  });
});
