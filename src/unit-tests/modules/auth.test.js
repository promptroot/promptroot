import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentUser,
  setCurrentUser,
  signInWithGitHub,
  signOutUser,
  updateAuthUI,
  initAuthStateListener
} from '../../modules/auth.js';
import { getAuth } from '../../modules/firebase-service.js';

// Mock dependencies
vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../utils/session-cache.js', () => ({
  setCache: vi.fn(),
  getCache: vi.fn()
}));

vi.mock('../../modules/jules-api.js', () => ({
  clearJulesKeyCache: vi.fn()
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

// Setup global mocks
const mockFirebaseAuth = {
  currentUser: null,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
};

const mockGithubAuthProvider = vi.fn();

global.window = {
  // window.auth is no longer used by the module, but we might keep it if other things use it
  // But for this test, we care about getAuth()
  auth: mockFirebaseAuth,
  firebase: {
    auth: {
      GithubAuthProvider: mockGithubAuthProvider
    }
  },
  populateFreeInputRepoSelection: vi.fn(),
  populateFreeInputBranchSelection: vi.fn()
};

global.firebase = {
  auth: {
    GithubAuthProvider: mockGithubAuthProvider
  }
};

Object.defineProperty(global, 'localStorage', {
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

// Mock DOM elements
const createMockElement = (id) => ({
  id,
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
    toggle: vi.fn()
  },
  style: {
    display: ''
  },
  textContent: '',
  src: '',
  alt: '',
  onclick: null,
  onload: null,
  onerror: null,
  nextElementSibling: {
    textContent: ''
  }
});

global.document = {
  getElementById: vi.fn()
};

function mockReset() {
  vi.clearAllMocks();
  
  // Reset auth mock
  mockFirebaseAuth.currentUser = null;
  mockFirebaseAuth.signInWithPopup.mockReset();
  mockFirebaseAuth.signOut.mockReset();
  mockFirebaseAuth.onAuthStateChanged.mockReset();
  
  // Configure getAuth to return the mock auth object by default
  getAuth.mockReturnValue(mockFirebaseAuth);

  // Reset global functions
  global.window.populateFreeInputRepoSelection = vi.fn().mockResolvedValue();
  global.window.populateFreeInputBranchSelection = vi.fn().mockResolvedValue();
  
  // Reset localStorage
  global.localStorage.getItem.mockReturnValue(null);
  global.localStorage.setItem.mockImplementation(() => {});
  global.localStorage.removeItem.mockImplementation(() => {});
  
  // Reset document.getElementById
  global.document.getElementById.mockImplementation((id) => {
    return createMockElement(id);
  });
  
  // Reset provider mock
  const mockProvider = {
    addScope: vi.fn()
  };
  mockGithubAuthProvider.mockReturnValue(mockProvider);
}

describe('auth', () => {
  beforeEach(() => {
    mockReset();
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(getCurrentUser()).toBe(null);
    });

    it('should return the current user from auth service if available', () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockFirebaseAuth.currentUser = mockUser;
      // getAuth returns mockFirebaseAuth which has currentUser
      
      const user = getCurrentUser();
      
      expect(user).toBe(mockUser);
    });

    it('should cache the user once retrieved', () => {
      const mockUser = { uid: '123', email: 'test@example.com' };
      mockFirebaseAuth.currentUser = mockUser;
      
      getCurrentUser();
      mockFirebaseAuth.currentUser = null; // Simulate auth state change?
      // But getCurrentUser implementation checks:
      // if (auth?.currentUser && auth.currentUser !== currentUser) { currentUser = auth.currentUser; }
      // So if auth.currentUser becomes null, currentUser variable inside auth.js REMAINS mockUser?
      // Wait:
      // if (auth?.currentUser ... )
      // If auth.currentUser is null, the block is skipped, and it returns `currentUser`.
      // So yes, it caches it (or rather, it holds a reference).
      
      const cachedUser = getCurrentUser();
      expect(cachedUser).toBe(mockUser);
    });

    it('should handle missing auth service', () => {
      setCurrentUser(null); // Reset cached user first
      getAuth.mockReturnValue(null);
      
      expect(getCurrentUser()).toBe(null);
    });
  });

  describe('setCurrentUser', () => {
    it('should set the current user', () => {
      const mockUser = { uid: '456', email: 'user@test.com' };
      
      setCurrentUser(mockUser);
      
      expect(getCurrentUser()).toBe(mockUser);
    });

    it('should accept null user', () => {
      setCurrentUser({ uid: '123' });
      setCurrentUser(null);
      
      expect(getCurrentUser()).toBe(null);
    });

    it('should overwrite existing user', () => {
      const user1 = { uid: '111' };
      const user2 = { uid: '222' };
      
      setCurrentUser(user1);
      setCurrentUser(user2);
      
      expect(getCurrentUser()).toBe(user2);
    });
  });

  describe('signInWithGitHub', () => {
    it('should show error if auth not ready', async () => {
      getAuth.mockReturnValue(null);
      const { showToast } = await import('../../modules/toast.js');
      
      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        'Authentication not ready. Please refresh the page.',
        'error'
      );
    });

    it('should create GitHub provider with public_repo scope', async () => {
      const mockProvider = {
        addScope: vi.fn()
      };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockResolvedValue({
        credential: {
          accessToken: 'test-token'
        }
      });

      await signInWithGitHub();
      
      expect(mockGithubAuthProvider).toHaveBeenCalled();
      expect(mockProvider.addScope).toHaveBeenCalledWith('public_repo');
    });

    it('should sign in with popup', async () => {
      const mockProvider = {
        addScope: vi.fn()
      };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockResolvedValue({
        credential: {
          accessToken: 'test-token'
        }
      });

      await signInWithGitHub();
      
      expect(mockFirebaseAuth.signInWithPopup).toHaveBeenCalledWith(mockProvider);
    });

    it('should store access token in localStorage on success', async () => {
      const mockProvider = { addScope: vi.fn() };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockResolvedValue({
        credential: {
          accessToken: 'github-token-123'
        }
      });

      await signInWithGitHub();
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'github_access_token',
        expect.stringContaining('github-token-123')
      );
    });

    it('should handle sign-in without access token', async () => {
      const mockProvider = { addScope: vi.fn() };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockResolvedValue({
        credential: null
      });

      await signInWithGitHub();
      
      expect(global.console.warn).toHaveBeenCalled();
      expect(global.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should show error toast on sign-in failure', async () => {
      const mockProvider = { addScope: vi.fn() };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockRejectedValue(new Error('Sign-in failed'));
      const { showToast } = await import('../../modules/toast.js');

      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        'Failed to sign in. Please try again.',
        'error'
      );
    });

    it('should log error on sign-in failure', async () => {
      const mockProvider = { addScope: vi.fn() };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      const error = new Error('Network error');
      mockFirebaseAuth.signInWithPopup.mockRejectedValue(error);

      await signInWithGitHub();
      
      expect(global.console.error).toHaveBeenCalledWith('Sign-in failed:', error);
    });
  });

  describe('signOutUser', () => {
    it('should sign out successfully', async () => {
      mockFirebaseAuth.signOut.mockResolvedValue();

      await signOutUser();
      
      expect(mockFirebaseAuth.signOut).toHaveBeenCalled();
    });

    it('should remove GitHub access token from localStorage', async () => {
      mockFirebaseAuth.signOut.mockResolvedValue();

      await signOutUser();
      
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('github_access_token');
    });

    it('should clear Jules key cache if user is signed in', async () => {
      const mockUser = { uid: 'user-123' };
      mockFirebaseAuth.currentUser = mockUser;
      mockFirebaseAuth.signOut.mockResolvedValue();
      const { clearJulesKeyCache } = await import('../../modules/jules-api.js');

      await signOutUser();
      
      expect(clearJulesKeyCache).toHaveBeenCalledWith('user-123');
    });

    it('should handle sign out when auth service is missing', async () => {
      getAuth.mockReturnValue(null);

      await expect(signOutUser()).resolves.toBeUndefined();
    });

    it('should show error toast on sign-out failure', async () => {
      mockFirebaseAuth.signOut.mockRejectedValue(new Error('Sign-out failed'));
      const { showToast } = await import('../../modules/toast.js');

      await signOutUser();
      
      expect(showToast).toHaveBeenCalledWith('Failed to sign out.', 'error');
    });

    it('should log error on sign-out failure', async () => {
      const error = new Error('Network error');
      mockFirebaseAuth.signOut.mockRejectedValue(error);

      await signOutUser();
      
      expect(global.console.error).toHaveBeenCalledWith('Sign-out failed:', error);
    });
  });

  describe('updateAuthUI', () => {
    it('should update UI for signed-in user', async () => {
      const mockUser = {
        uid: 'user-123',
        displayName: 'Test User',
        email: 'test@example.com',
        photoURL: 'https://example.com/avatar.jpg'
      };

      await updateAuthUI(mockUser);
      
      expect(getCurrentUser()).toBe(mockUser);
    });

    it('should set user avatar when user has photoURL', async () => {
      const mockUser = {
        uid: 'user-123',
        displayName: 'Test User',
        photoURL: 'https://example.com/avatar.jpg'
      };
      const mockAvatar = createMockElement('userAvatar');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'userAvatar') return mockAvatar;
        return createMockElement(id);
      });

      await updateAuthUI(mockUser);
      
      expect(mockAvatar.src).toBe('https://example.com/avatar.jpg');
      expect(mockAvatar.alt).toBe('Test User');
    });

    it('should hide sign-in and show sign-out when user is signed in', async () => {
      const mockUser = { uid: 'user-123', displayName: 'Test' };
      const mockSignIn = createMockElement('headerSignIn');
      const mockSignOut = createMockElement('headerSignOut');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'headerSignIn') return mockSignIn;
        if (id === 'headerSignOut') return mockSignOut;
        return createMockElement(id);
      });

      await updateAuthUI(mockUser);
      
      expect(mockSignIn.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockSignOut.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('should set sign-out onclick handler', async () => {
      const mockUser = { uid: 'user-123' };
      const mockSignOut = createMockElement('headerSignOut');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'headerSignOut') return mockSignOut;
        return createMockElement(id);
      });

      await updateAuthUI(mockUser);
      
      expect(mockSignOut.onclick).toBe(signOutUser);
    });

    it('should update UI for signed-out state', async () => {
      await updateAuthUI(null);
      
      expect(getCurrentUser()).toBe(null);
    });

    it('should show sign-in and hide sign-out when user is signed out', async () => {
      const mockSignIn = createMockElement('headerSignIn');
      const mockSignOut = createMockElement('headerSignOut');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'headerSignIn') return mockSignIn;
        if (id === 'headerSignOut') return mockSignOut;
        return createMockElement(id);
      });

      await updateAuthUI(null);
      
      expect(mockSignIn.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockSignOut.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('should set sign-in onclick handler when signed out', async () => {
      const mockSignIn = createMockElement('headerSignIn');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'headerSignIn') return mockSignIn;
        return createMockElement(id);
      });

      await updateAuthUI(null);
      
      expect(mockSignIn.onclick).toBe(signInWithGitHub);
    });

    it('should update dropdown user name', async () => {
      const mockUser = {
        displayName: 'John Doe',
        email: 'john@example.com'
      };
      const mockDropdownName = createMockElement('dropdownUserName');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'dropdownUserName') return mockDropdownName;
        return createMockElement(id);
      });

      await updateAuthUI(mockUser);
      
      expect(mockDropdownName.textContent).toBe('John Doe');
    });

    it('should show Guest when signed out', async () => {
      const mockDropdownName = createMockElement('dropdownUserName');
      
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'dropdownUserName') return mockDropdownName;
        return createMockElement(id);
      });

      await updateAuthUI(null);
      
      expect(mockDropdownName.textContent).toBe('Guest');
    });

    it('should use cached avatar if available', async () => {
      const mockUser = {
        uid: 'user-123',
        displayName: 'Test User',
        photoURL: 'https://example.com/avatar.jpg'
      };
      const mockAvatar = createMockElement('userAvatar');
      const { getCache } = await import('../../utils/session-cache.js');
      
      getCache.mockReturnValue('https://cached-avatar.jpg');
      global.document.getElementById.mockImplementation((id) => {
        if (id === 'userAvatar') return mockAvatar;
        return createMockElement(id);
      });

      await updateAuthUI(mockUser);
      
      expect(mockAvatar.src).toBe('https://cached-avatar.jpg');
    });

    it('should call populateFreeInputRepoSelection if available', async () => {
      const mockUser = { uid: 'user-123' };
      
      await updateAuthUI(mockUser);
      
      expect(window.populateFreeInputRepoSelection).toHaveBeenCalled();
    });

    it('should throw error with missing DOM elements', async () => {
      global.document.getElementById.mockReturnValue(null);
      const mockUser = { uid: 'user-123', displayName: 'Test' };

      await expect(updateAuthUI(mockUser)).rejects.toThrow();
    });

    it('should handle dropdown population errors', async () => {
      window.populateFreeInputRepoSelection = vi.fn().mockRejectedValue(new Error('Failed'));
      const mockUser = { uid: 'user-123' };

      await updateAuthUI(mockUser);
      
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('initAuthStateListener', () => {
    it('should initialize auth state listener', () => {
      initAuthStateListener();
      
      expect(mockFirebaseAuth.onAuthStateChanged).toHaveBeenCalled();
    });

    it('should call updateAuthUI when auth state changes', () => {
      let authCallback;
      mockFirebaseAuth.onAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
      });

      initAuthStateListener();
      
      expect(authCallback).toBeDefined();
    });

    it('should handle missing auth service', () => {
      getAuth.mockReturnValue(null);

      initAuthStateListener();
      
      expect(global.console.error).toHaveBeenCalledWith('Auth not initialized yet');
    });

    it('should handle listener initialization errors', () => {
      mockFirebaseAuth.onAuthStateChanged.mockImplementation(() => {
        throw new Error('Listener error');
      });

      initAuthStateListener();
      
      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete sign-in workflow', async () => {
      const mockProvider = { addScope: vi.fn() };
      mockGithubAuthProvider.mockReturnValue(mockProvider);
      mockFirebaseAuth.signInWithPopup.mockResolvedValue({
        credential: {
          accessToken: 'test-token'
        },
        user: {
          uid: 'user-123',
          displayName: 'Test User'
        }
      });

      await signInWithGitHub();
      
      expect(mockFirebaseAuth.signInWithPopup).toHaveBeenCalled();
      expect(global.localStorage.setItem).toHaveBeenCalled();
    });

    it('should handle complete sign-out workflow', async () => {
      const mockUser = { uid: 'user-123' };
      mockFirebaseAuth.currentUser = mockUser;
      mockFirebaseAuth.signOut.mockResolvedValue();
      const { clearJulesKeyCache } = await import('../../modules/jules-api.js');

      await signOutUser();
      
      expect(clearJulesKeyCache).toHaveBeenCalledWith('user-123');
      expect(mockFirebaseAuth.signOut).toHaveBeenCalled();
      expect(global.localStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle auth state listener with user changes', () => {
      let authCallback;
      mockFirebaseAuth.onAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
      });

      initAuthStateListener();
      
      const mockUser = { uid: 'user-123', displayName: 'Test' };
      authCallback(mockUser);
      
      expect(getCurrentUser()).toBe(mockUser);
    });
  });
});
