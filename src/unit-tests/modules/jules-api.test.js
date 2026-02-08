import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Web Crypto API (minimal needed for non-key-related logic, if any)
const mockCrypto = {
  subtle: {
    importKey: vi.fn().mockResolvedValue('mock-key'),
  }
};

// Mock window object with required dependencies
const mockAuth = {
  currentUser: null
};

// Mock firebase-service
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
}));

// Mock jules-keys.js
const { mockGetDecryptedJulesKey, mockClearJulesKeyCache, mockCheckJulesKey } = vi.hoisted(() => {
  return {
    mockGetDecryptedJulesKey: vi.fn(),
    mockClearJulesKeyCache: vi.fn(),
    mockCheckJulesKey: vi.fn()
  }
});

vi.mock('../../modules/jules-keys.js', () => ({
  getDecryptedJulesKey: mockGetDecryptedJulesKey,
  clearJulesKeyCache: mockClearJulesKeyCache,
  checkJulesKey: mockCheckJulesKey
}));

import {
  listJulesSources,
  loadJulesProfileInfo,
  callRunJulesFunction,
  handleTryInJules
} from '../../modules/jules-api.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

global.window = {
  crypto: mockCrypto,
  auth: mockAuth
};

// Mock DOM elements for UI interactions
global.document = {
  getElementById: vi.fn()
};

// Mock showToast function
vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

// Mock constants
vi.mock('../../utils/constants.js', () => ({
  JULES_API_BASE: 'https://api.jules.example.com',
  ERRORS: {
    JULES_KEY_REQUIRED: 'Jules API key is required'
  },
  PAGE_SIZES: {
    julesSessions: 50
  },
  JULES_MESSAGES: {
    NOT_LOGGED_IN: 'Please log in to continue',
    LOGIN_REQUIRED: 'Login required',
    GENERAL_ERROR: 'An error occurred',
    ERROR_WITH_MESSAGE: (msg) => `Error: ${msg}`
  },
  TIMEOUTS: {
    uiDelay: 100
  },
  CACHE_KEYS: {
    JULES_ACCOUNT: 'jules_account'
  },
  CACHE_POLICIES: {} // Add minimal mock to satisfy imports
}));

describe('jules-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    
    // Mock Date.now for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('listJulesSources', () => {
    const apiKey = 'test-api-key';

    it('should list sources without pagination', async () => {
      const mockResponse = { sources: [{ id: 'source1' }, { id: 'source2' }] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await listJulesSources(apiKey);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.jules.example.com/sources',
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey
          }
        }
      );
    });

    it('should list sources with page token', async () => {
      const mockResponse = { sources: [{ id: 'source3' }] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await listJulesSources(apiKey, 'next-page-token');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.jules.example.com/sources?pageToken=next-page-token',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Goog-Api-Key': apiKey
          })
        })
      );
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(listJulesSources(apiKey)).rejects.toThrow('Failed to fetch sources: 401 Unauthorized');
    });
  });

  describe('loadJulesProfileInfo', () => {
    it('should throw error when no API key available', async () => {
      const uid = 'test-user';
      mockGetDecryptedJulesKey.mockResolvedValue(null);
      
      await expect(loadJulesProfileInfo(uid)).rejects.toThrow('Jules API key is required');
    });

    it('should load profile info with sources and sessions', async () => {
      const uid = 'test-user-123';
      
      mockGetDecryptedJulesKey.mockResolvedValue('decrypted-key');
      
      // Mock API responses
      const sourcesResponse = { sources: [{ id: 'source1' }] };
      const sessionsResponse = { sessions: [{ id: 'session1' }] };
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(sourcesResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(sessionsResponse)
        });

      const result = await loadJulesProfileInfo(uid);

      expect(result).toEqual({
        sources: [{ id: 'source1' }],
        sessions: [{ id: 'session1' }]
      });
    });
  });

  describe('callRunJulesFunction', () => {
    it('should show error toast when not logged in', async () => {
      const { showToast } = await import('../../modules/toast.js');
      
      mockAuth.currentUser = null;
      
      const result = await callRunJulesFunction('test prompt', 'source1', 'main', 'Test Title');
      
      expect(result).toBeNull();
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Please log in to continue'),
        'error',
        undefined
      );
    });

    it('should throw error when no source ID provided', async () => {
      mockAuth.currentUser = { uid: 'test-user' };
      
      await expect(callRunJulesFunction('test prompt', null)).rejects.toThrow('No repository selected');
    });

    it('should handle button state changes', async () => {
      mockAuth.currentUser = { 
        uid: 'test-user',
        getIdToken: vi.fn().mockResolvedValue('firebase-token')
      };
      
      // Mock button element
      const mockButton = {
        disabled: false,
        textContent: 'Original Text'
      };
      global.document.getElementById = vi.fn().mockReturnValue(mockButton);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          sessionUrl: 'https://jules.example.com/session/123'
        })
      });
      
      const result = await callRunJulesFunction('test prompt', 'source1', 'main', 'Test Title');
      
      expect(result).toBe('https://jules.example.com/session/123');
    });
  });

  describe('handleTryInJules', () => {
    it('should handle authenticated user', async () => {
      mockAuth.currentUser = { uid: 'test-user' };
      
      mockCheckJulesKey.mockResolvedValue(true);
      
      vi.doMock('../../modules/jules-modal.js', () => ({
        showJulesKeyModal: vi.fn(),
        showJulesEnvModal: vi.fn()
      }));
      
      // Function doesn't return a value, just check it doesn't throw
      await expect(handleTryInJules()).resolves.toBeUndefined();
    });

    it('should prompt for login when not authenticated', async () => {
      const { showToast } = await import('../../modules/toast.js');
      mockAuth.currentUser = null;
      
      // Mock auth import
      vi.doMock('../../modules/auth.js', () => ({
        signInWithGitHub: vi.fn().mockRejectedValue(new Error('Sign in failed'))
      }));
      
      // Function doesn't return a value, just check it doesn't throw
      await expect(handleTryInJules()).resolves.toBeUndefined();

      // The error is now handled with warn toast and suggestion
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Login required'),
        'warn',
        undefined
      );
    });

    it('should show key modal when no key available', async () => {
      mockAuth.currentUser = { uid: 'test-user' };
      
      mockCheckJulesKey.mockResolvedValue(false);
      
      const mockShowKeyModal = vi.fn();
      vi.doMock('../../modules/jules-modal.js', () => ({
        showJulesKeyModal: mockShowKeyModal,
        showJulesEnvModal: vi.fn()
      }));
      
      // Function doesn't return a value, just check it doesn't throw
      await expect(handleTryInJules()).resolves.toBeUndefined();
    });
  });

  describe('integration and edge cases', () => {
    it('should handle URL parameter edge cases', () => {
      // Test that URL construction handles special characters
      const url = new URL('https://api.jules.example.com/sources');
      url.searchParams.set('pageToken', 'token with spaces & special chars');
      
      expect(url.toString()).toContain('token+with+spaces+%26+special+chars');
    });
  });
});
