
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showUserProfileModal, loadProfileDirectly } from '../../modules/jules-account.js';
import * as firebaseService from '../../modules/firebase-service.js';
import * as julesKeys from '../../modules/jules-keys.js';
import * as statusRenderer from '../../modules/status-renderer.js';
import * as errorHandler from '../../utils/error-handler.js';
import * as domHelpers from '../../utils/dom-helpers.js';

// Mock dependencies
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

vi.mock('../../modules/jules-keys.js', () => ({
  checkJulesKey: vi.fn(),
  deleteStoredJulesKey: vi.fn(),
  getDecryptedJulesKey: vi.fn()
}));

vi.mock('../../modules/jules-api.js', () => ({
  loadJulesProfileInfo: vi.fn(),
  listJulesSessions: vi.fn(),
  getDecryptedJulesKey: vi.fn()
}));

vi.mock('../../modules/status-renderer.js', () => ({
  renderStatus: vi.fn(),
  STATUS_TYPES: {
    SAVED: 'saved',
    NOT_SAVED: 'not-saved',
    LOADING: 'loading',
    ERROR: 'error'
  }
}));

vi.mock('../../utils/error-handler.js', () => ({
  handleError: vi.fn(),
  ErrorCategory: {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH'
  }
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  toggleVisibility: vi.fn(),
  createIcon: vi.fn(),
  clearElement: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/confirm-modal.js', () => ({
  showConfirm: vi.fn()
}));

vi.mock('../../modules/prompt-viewer.js', () => ({
  attachPromptViewerHandlers: vi.fn()
}));

vi.mock('../../utils/session-cache.js', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCache: vi.fn(),
  CACHE_KEYS: {}
}));

describe('jules-account.js', () => {
  let modal;
  let profileUserName, julesKeyStatus, addBtn, resetBtn, dangerZoneSection, closeBtn, loadJulesInfoBtn, julesProfileInfoSection;

  beforeEach(() => {
    // Setup DOM
    modal = document.createElement('div');
    modal.id = 'userProfileModal';
    document.body.appendChild(modal);

    profileUserName = document.createElement('div');
    profileUserName.id = 'profileUserName';
    document.body.appendChild(profileUserName);

    julesKeyStatus = document.createElement('div');
    julesKeyStatus.id = 'julesKeyStatus';
    document.body.appendChild(julesKeyStatus);

    addBtn = document.createElement('button');
    addBtn.id = 'addJulesKeyBtn';
    document.body.appendChild(addBtn);

    resetBtn = document.createElement('button');
    resetBtn.id = 'resetJulesKeyBtn';
    document.body.appendChild(resetBtn);

    dangerZoneSection = document.createElement('div');
    dangerZoneSection.id = 'dangerZoneSection';
    document.body.appendChild(dangerZoneSection);

    closeBtn = document.createElement('button');
    closeBtn.id = 'closeProfileBtn';
    document.body.appendChild(closeBtn);

    loadJulesInfoBtn = document.createElement('button');
    loadJulesInfoBtn.id = 'loadJulesInfoBtn';
    document.body.appendChild(loadJulesInfoBtn);

    julesProfileInfoSection = document.createElement('div');
    julesProfileInfoSection.id = 'julesProfileInfoSection';
    document.body.appendChild(julesProfileInfoSection);

    // Additional elements required by the module but not focus of test
    ['julesSourcesList', 'julesSessionsList', 'viewAllSessionsLink', 'viewQueueLink',
     'closeSessionsHistoryBtn', 'loadMoreSessionsBtn', 'sessionSearchInput',
     'julesSessionsHistoryModal', 'allSessionsList', 'sessionsLoadMore'
    ].forEach(id => {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    });

    vi.spyOn(firebaseService, 'getAuth').mockReturnValue({ currentUser: { uid: '123', displayName: 'Test User' } });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('showUserProfileModal', () => {
    it('should handle checkJulesKey error gracefully', async () => {
      const error = new Error('Network error');
      vi.spyOn(julesKeys, 'checkJulesKey').mockRejectedValue(error);

      showUserProfileModal();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ source: 'showUserProfileModal.checkKey' }),
        expect.objectContaining({ category: 'NETWORK' })
      );

      expect(statusRenderer.renderStatus).toHaveBeenCalledWith(
        julesKeyStatus,
        statusRenderer.STATUS_TYPES.NOT_SAVED,
        'Unable to check'
      );

      // Ensure fallback UI state
      expect(domHelpers.toggleVisibility).toHaveBeenCalledWith(addBtn, true); // Assuming fallback shows add button
      // We can't easily check for 'false' calls without checking order or filtering,
      // but showing addBtn implies we're in a "not logged in / error" state visually.
    });
  });

  describe('loadProfileDirectly', () => {
    it('should handle checkJulesKey error gracefully', async () => {
      const error = new Error('Network error');
      vi.spyOn(julesKeys, 'checkJulesKey').mockRejectedValue(error);

      await loadProfileDirectly({ uid: '123', displayName: 'Test User' });

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ source: 'loadProfileDirectly.checkKey' }),
        expect.objectContaining({ category: 'NETWORK' })
      );

      expect(statusRenderer.renderStatus).toHaveBeenCalledWith(
        julesKeyStatus,
        statusRenderer.STATUS_TYPES.NOT_SAVED,
        'Unable to check'
      );
    });
  });
});
