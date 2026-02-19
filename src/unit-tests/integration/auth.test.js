import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUser, signInWithGitHub, signOutUser, updateAuthUI } from '../../modules/auth.js';
import { showToast } from '../../modules/toast.js';
import { clearJulesKeyCache } from '../../modules/jules-api.js';
import { getAuth } from '../../modules/firebase-service.js';

// Mock dependencies
vi.mock('../../modules/toast.js');
vi.mock('../../modules/jules-api.js');
vi.mock('../../modules/firebase-service.js');

// Setup DOM elements
function setupDOM() {
  document.body.innerHTML = `
    <div id="authStatus"></div>
    <div id="userDisplay"></div>
    <img id="userAvatar" class="hidden" />
    <span id="userName"></span>
    <span id="dropdownUserName"></span>
    <img id="dropdownAvatar" />
    <button id="headerSignIn"></button>
    <button id="headerSignOut" class="hidden"></button>
  `;
}

describe('Auth Module', () => {
  let mockAuth;

  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
    
    // Setup mock auth instance
    mockAuth = {
      currentUser: null,
      signInWithPopup: vi.fn(),
      signOut: vi.fn()
    };
    
    vi.mocked(getAuth).mockReturnValue(mockAuth);
  });

  describe('getCurrentUser', () => {
    it('should return null initially', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('should update current user from auth instance', () => {
      const user = { uid: '123' };
      mockAuth.currentUser = user;
      expect(getCurrentUser()).toBe(user);
    });
  });

  describe('signInWithGitHub', () => {
    it('should call signInWithPopup and store token', async () => {
      mockAuth.signInWithPopup.mockResolvedValue({
        credential: { accessToken: 'token123' }
      });

      await signInWithGitHub();

      expect(mockAuth.signInWithPopup).toHaveBeenCalled();
      expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith('github_access_token', expect.any(String));
    });

    it('should show error toast when auth not ready', async () => {
      vi.mocked(getAuth).mockReturnValue(null);
      
      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        'Authentication not ready. Please refresh the page.',
        'error'
      );
    });

    it('should show error toast on sign-in failure', async () => {
      mockAuth.signInWithPopup.mockRejectedValue(new Error('Network error'));
      
      await signInWithGitHub();
      
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sign in'),
        'error'
      );
    });
  });

  describe('signOutUser', () => {
    it('should sign out user and clear token', async () => {
      mockAuth.currentUser = { uid: '123' };
      
      await signOutUser();

      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(vi.mocked(localStorage.removeItem)).toHaveBeenCalledWith('github_access_token');
      expect(clearJulesKeyCache).toHaveBeenCalled();
    });
  });

  describe('updateAuthUI', () => {
      it('should update UI for logged in user', () => {
          const user = {
              uid: '123',
              displayName: 'Test User',
              photoURL: 'http://example.com/photo.jpg',
              email: 'test@example.com'
          };

          updateAuthUI(user);

          const avatar = document.getElementById('userAvatar');
          const signIn = document.getElementById('headerSignIn');
          const signOut = document.getElementById('headerSignOut');
          const ddName = document.getElementById('dropdownUserName');

          // Image loading is async in the code (onload), so we check the src was set
          expect(avatar.src).toBe(user.photoURL);
          // UI Logic: cached avatar might show it immediately, but here we don't have cache.
          // The code sets src and waits for onload.
          // We can check other elements
          expect(ddName.textContent).toBe('Test User');
          expect(signIn.classList.contains('hidden')).toBe(true);
          expect(signOut.classList.contains('hidden')).toBe(false);
      });

      it('should update UI for guest', () => {
          updateAuthUI(null);

          const userDisplay = document.getElementById('userDisplay');
          const signIn = document.getElementById('headerSignIn');
          const signOut = document.getElementById('headerSignOut');

          expect(userDisplay.classList.contains('hidden')).toBe(false);
          expect(signIn.classList.contains('hidden')).toBe(false);
          expect(signOut.classList.contains('hidden')).toBe(true);
      });
  });
});
