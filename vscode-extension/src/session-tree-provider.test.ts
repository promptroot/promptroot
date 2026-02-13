import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionTreeProvider } from './session-tree-provider';
import { JulesSession } from './models';
import { Timestamp } from 'firebase/firestore';

// Mock output channel
const mockOutputChannel = {
  appendLine: vi.fn(),
  append: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
  name: 'Test',
  replace: vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock Firestore Service
const mockFirestoreService = {
  subscribeToSessions: vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Mock Auth Manager
const mockAuthManager = {
  getCurrentUser: vi.fn(),
  onAuthStateChanged: vi.fn(),
  isSignedIn: vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('SessionTreeProvider', () => {
  let provider: SessionTreeProvider;
  let authStateCallback: ((user: { uid: string } | null) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Capture the auth state callback
    mockAuthManager.onAuthStateChanged.mockImplementation((callback: (user: { uid: string } | null) => void) => {
      authStateCallback = callback;
    });

    provider = new SessionTreeProvider(
      mockFirestoreService,
      mockAuthManager,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockOutputChannel as any
    );
  });

  describe('initialization', () => {
    it('should subscribe to auth state changes', () => {
      expect(mockAuthManager.onAuthStateChanged).toHaveBeenCalled();
    });

    it('should subscribe to sessions when user is signed in', () => {
      const mockUser = { uid: 'test-user-123' };
      mockAuthManager.getCurrentUser.mockReturnValue(mockUser);

      if (authStateCallback) {
        authStateCallback(mockUser);
      }

      expect(mockFirestoreService.subscribeToSessions).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      const sessions = provider.getAllSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });
  });

  describe('filterSessionsByStatus', () => {
    it('should filter sessions by status', () => {
      // Create mock sessions
      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Test 1',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '2',
          name: 'Test 2',
          promptPath: '/test/2.md',
          sourceId: 'test',
          branch: 'main',
          status: 'FAILED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '3',
          name: 'Test 3',
          promptPath: '/test/3.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      // Simulate receiving sessions
      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      // Get the callback from subscribeToSessions and call it
      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const completedSessions = provider.filterSessionsByStatus('COMPLETED');
      expect(completedSessions.length).toBe(2);
      expect(completedSessions.every(s => s.status === 'COMPLETED')).toBe(true);

      const failedSessions = provider.filterSessionsByStatus('FAILED');
      expect(failedSessions.length).toBe(1);
      expect(failedSessions[0].status).toBe('FAILED');
    });

    it('should return empty array for status with no matches', () => {
      const sessions = provider.filterSessionsByStatus('IN_PROGRESS');
      expect(sessions).toEqual([]);
    });
  });

  describe('filterSessionsByDateRange', () => {
    it('should filter sessions by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Recent',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.fromDate(yesterday),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '2',
          name: 'Old',
          promptPath: '/test/2.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.fromDate(weekAgo),
          julesUrl: 'https://test.com'
        }
      ];

      // Simulate receiving sessions
      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const recentSessions = provider.filterSessionsByDateRange(twoDaysAgo, now);
      expect(recentSessions.length).toBe(1);
      expect(recentSessions[0].sessionId).toBe('1');
    });

    it('should return empty array when no sessions in range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const sessions = provider.filterSessionsByDateRange(yesterday, now);
      expect(sessions).toEqual([]);
    });
  });

  describe('searchSessions', () => {
    it('should search sessions by name', () => {
      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Fix User Auth Bug',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '2',
          name: 'Add New Feature',
          promptPath: '/test/2.md',
          sourceId: 'test',
          branch: 'feature/new',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const authSessions = provider.searchSessions('auth');
      expect(authSessions.length).toBe(1);
      expect(authSessions[0].name).toContain('Auth');
    });

    it('should search sessions by prompt path', () => {
      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Test 1',
          promptPath: '/prompts/auth/login.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '2',
          name: 'Test 2',
          promptPath: '/prompts/features/new.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const authSessions = provider.searchSessions('auth');
      expect(authSessions.length).toBe(1);
      expect(authSessions[0].promptPath).toContain('auth');
    });

    it('should search sessions by branch', () => {
      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Test 1',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'feature/awesome-feature',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        },
        {
          sessionId: '2',
          name: 'Test 2',
          promptPath: '/test/2.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const featureSessions = provider.searchSessions('feature');
      expect(featureSessions.length).toBe(1);
      expect(featureSessions[0].branch).toContain('feature');
    });

    it('should be case-insensitive', () => {
      const mockSessions: JulesSession[] = [
        {
          sessionId: '1',
          name: 'Important Update',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const results = provider.searchSessions('IMPORTANT');
      expect(results.length).toBe(1);
    });

    it('should return empty array when no matches', () => {
      const sessions = provider.searchSessions('nonexistent');
      expect(sessions).toEqual([]);
    });
  });

  describe('getSessionById', () => {
    it('should return session by ID', () => {
      const mockSessions: JulesSession[] = [
        {
          sessionId: 'test-session-123',
          name: 'Test Session',
          promptPath: '/test/1.md',
          sourceId: 'test',
          branch: 'main',
          status: 'COMPLETED',
          createdAt: Timestamp.now(),
          julesUrl: 'https://test.com'
        }
      ];

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: 'test-user' });
      if (authStateCallback) {
        authStateCallback({ uid: 'test-user' });
      }

      const onUpdateCallback = mockFirestoreService.subscribeToSessions.mock.calls[0]?.[1];
      if (onUpdateCallback) {
        onUpdateCallback(mockSessions);
      }

      const session = provider.getSessionById('test-session-123');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('test-session-123');
    });

    it('should return undefined for non-existent session', () => {
      const session = provider.getSessionById('non-existent');
      expect(session).toBeUndefined();
    });
  });
});
