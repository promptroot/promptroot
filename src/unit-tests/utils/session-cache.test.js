import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setCache, getCache, getCacheState, clearCache, clearAllCache, CACHE_KEYS } from '../../utils/session-cache.js';
import { CACHE_STRATEGIES } from '../../utils/constants.js';

describe('session-cache', () => {
  let originalDateNow;

  beforeEach(() => {
    sessionStorage.clear();
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
    sessionStorage.clear();
  });

  describe('CACHE_KEYS', () => {
    it('should export all cache key constants', () => {
      expect(CACHE_KEYS).toBeDefined();
      expect(CACHE_KEYS.JULES_ACCOUNT).toBe('jules_account_info');
      expect(CACHE_KEYS.JULES_SESSIONS).toBe('jules_sessions');
      expect(CACHE_KEYS.JULES_REPOS).toBe('jules_repos');
      expect(CACHE_KEYS.QUEUE_ITEMS).toBe('queue_items');
      expect(CACHE_KEYS.BRANCHES).toBe('branches_v2');
      expect(CACHE_KEYS.CURRENT_BRANCH).toBe('current_branch');
      expect(CACHE_KEYS.CURRENT_REPO).toBe('current_repo');
      expect(CACHE_KEYS.USER_PROFILE).toBe('user_profile');
      expect(CACHE_KEYS.USER_AVATAR).toBe('user_avatar');
    });
  });

  describe('setCache', () => {
    it('should store data with timestamp', () => {
      const testData = { name: 'test', value: 123 };
      const mockTime = 1234567890;
      Date.now = () => mockTime;

      setCache('test_key', testData);

      const stored = JSON.parse(sessionStorage.getItem('test_key'));
      expect(stored.data).toEqual(testData);
      expect(stored.timestamp).toBe(mockTime);
    });

    it('should store data with userId suffix', () => {
      const testData = { name: 'test' };
      
      setCache('test_key', testData, 'user123');

      expect(sessionStorage.getItem('test_key_user123')).toBeDefined();
      expect(sessionStorage.getItem('test_key')).toBeNull();
    });

    it('should handle complex data structures', () => {
      const complexData = {
        nested: { deep: { value: 'test' } },
        array: [1, 2, 3],
        bool: true,
        null: null
      };

      setCache('complex', complexData);

      const stored = JSON.parse(sessionStorage.getItem('complex'));
      expect(stored.data).toEqual(complexData);
    });

    it('should handle sessionStorage errors gracefully', () => {
      // Mock sessionStorage.setItem to throw error (storage quota exceeded)
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      // Should not throw
      expect(() => {
        setCache('test', { data: 'test' });
      }).not.toThrow();

      sessionStorage.setItem = originalSetItem;
    });

    it('should overwrite existing cache data', () => {
      setCache('key', { value: 'old' });
      setCache('key', { value: 'new' });

      const stored = JSON.parse(sessionStorage.getItem('key'));
      expect(stored.data.value).toBe('new');
    });
  });

  describe('getCacheState', () => {
    it('should return metadata for existing cache', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('test_key', testData);

      const state = getCacheState('test_key');
      expect(state.exists).toBe(true);
      expect(state.data).toEqual(testData);
      expect(state.timestamp).toBe(mockTime);
      expect(state.age).toBe(0);
      expect(state.isStale).toBe(false);
    });

    it('should identify stale cache', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('test_key', testData); // Default TTL is short (5 mins)

      Date.now = () => mockTime + 301000; // 5 mins + 1 sec

      const state = getCacheState('test_key');
      expect(state.exists).toBe(true);
      expect(state.isStale).toBe(true);
      expect(state.age).toBe(301000);
    });

    it('should return non-existent state for missing key', () => {
      const state = getCacheState('missing');
      expect(state.exists).toBe(false);
      expect(state.data).toBeNull();
    });

    it('should respect CACHE_POLICIES for JULES_ACCOUNT (session duration)', () => {
       const testData = { name: 'session' };
       const mockTime = 1000000;
       Date.now = () => mockTime;

       setCache(CACHE_KEYS.JULES_ACCOUNT, testData);

       Date.now = () => mockTime + 100000000; // Long time

       const state = getCacheState(CACHE_KEYS.JULES_ACCOUNT);
       expect(state.isStale).toBe(false);
       expect(state.policy.strategy).toBe(CACHE_STRATEGIES.CACHE_FIRST);
    });
  });

  describe('getCache', () => {
    it('should retrieve cached data within time limit', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('test_key', testData);

      // Move forward 1 minute (within 5 minute default)
      Date.now = () => mockTime + 60000;

      const retrieved = getCache('test_key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for expired cache (default duration)', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('unknown_key', testData);

      // Move forward 6 minutes (past 5 minute default)
      Date.now = () => mockTime + 360000;

      const retrieved = getCache('unknown_key');
      expect(retrieved).toBeNull();
    });

    it('should return session cache regardless of time for JULES_ACCOUNT', () => {
      const testData = { account: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.JULES_ACCOUNT, testData);

      // Move forward 10 hours (way past 5 minutes)
      Date.now = () => mockTime + 36000000;

      const retrieved = getCache(CACHE_KEYS.JULES_ACCOUNT);
      expect(retrieved).toEqual(testData);
    });

    it('should return session cache regardless of time for QUEUE_ITEMS', () => {
      const testData = [{ id: 1 }, { id: 2 }];
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.QUEUE_ITEMS, testData);

      Date.now = () => mockTime + 36000000;

      const retrieved = getCache(CACHE_KEYS.QUEUE_ITEMS);
      expect(retrieved).toEqual(testData);
    });

    it('should return session cache for BRANCHES', () => {
      const testData = ['main', 'develop'];
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.BRANCHES, testData);
      Date.now = () => mockTime + 36000000;

      const retrieved = getCache(CACHE_KEYS.BRANCHES);
      expect(retrieved).toEqual(testData);
    });

    it('should return session cache for USER_AVATAR', () => {
      const testData = 'https://example.com/avatar.png';
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.USER_AVATAR, testData);
      Date.now = () => mockTime + 36000000;

      const retrieved = getCache(CACHE_KEYS.USER_AVATAR);
      expect(retrieved).toBe(testData);
    });

    it('should retrieve data with userId suffix', () => {
      const testData = { name: 'user-specific' };
      
      setCache('test_key', testData, 'user123');

      const retrieved = getCache('test_key', 'user123');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent cache', () => {
      const retrieved = getCache('nonexistent_key');
      expect(retrieved).toBeNull();
    });

    it('should remove expired cache entries', () => {
      const testData = { name: 'test' };
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache('expiring_key', testData);

      // Move past expiration
      Date.now = () => mockTime + 400000;

      getCache('expiring_key');

      // Should be removed from storage
      expect(sessionStorage.getItem('expiring_key')).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      sessionStorage.setItem('bad_json', '{invalid json}');

      const retrieved = getCache('bad_json');
      
      expect(retrieved).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting cache state:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle sessionStorage errors gracefully', () => {
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = () => {
        throw new Error('Storage access error');
      };

      const retrieved = getCache('test');
      
      expect(retrieved).toBeNull();

      sessionStorage.getItem = originalGetItem;
    });

    it('should handle missing timestamp in cached data', () => {
      sessionStorage.setItem('bad_format', JSON.stringify({ data: 'test' }));

      const retrieved = getCache('bad_format');
      
      // Missing timestamp results in NaN age check, which fails and returns null
      expect(retrieved).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear specific cache entry', () => {
      setCache('key1', { data: 'test1' });
      setCache('key2', { data: 'test2' });

      clearCache('key1');

      expect(sessionStorage.getItem('key1')).toBeNull();
      expect(sessionStorage.getItem('key2')).not.toBeNull();
    });

    it('should clear cache with userId suffix', () => {
      setCache('key', { data: 'test' }, 'user123');

      clearCache('key', 'user123');

      expect(sessionStorage.getItem('key_user123')).toBeNull();
    });

    it('should handle clearing non-existent cache', () => {
      expect(() => {
        clearCache('nonexistent');
      }).not.toThrow();
    });

    it('should handle sessionStorage errors gracefully', () => {
      const originalRemoveItem = sessionStorage.removeItem;
      sessionStorage.removeItem = () => {
        throw new Error('Storage error');
      };

      expect(() => {
        clearCache('test');
      }).not.toThrow();

      sessionStorage.removeItem = originalRemoveItem;
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache entries', () => {
      setCache('key1', { data: 'test1' });
      setCache('key2', { data: 'test2' });
      setCache('key3', { data: 'test3' }, 'user123');

      clearAllCache();

      expect(sessionStorage.length).toBe(0);
    });

    it('should handle errors gracefully', () => {
      const originalClear = sessionStorage.clear;
      sessionStorage.clear = () => {
        throw new Error('Storage error');
      };

      expect(() => {
        clearAllCache();
      }).not.toThrow();

      sessionStorage.clear = originalClear;
    });
  });

  describe('cache integration scenarios', () => {
    it('should handle multiple users with different cache data', () => {
      const user1Data = { name: 'User 1' };
      const user2Data = { name: 'User 2' };

      setCache('profile', user1Data, 'user1');
      setCache('profile', user2Data, 'user2');

      expect(getCache('profile', 'user1')).toEqual(user1Data);
      expect(getCache('profile', 'user2')).toEqual(user2Data);
    });

    it('should handle mixed session and time-based caches', () => {
      const mockTime = 1000000;
      Date.now = () => mockTime;

      setCache(CACHE_KEYS.JULES_ACCOUNT, { session: 'data' });
      setCache('temp_data', { time: 'limited' });

      // Move forward past default cache duration
      Date.now = () => mockTime + 400000;

      expect(getCache(CACHE_KEYS.JULES_ACCOUNT)).toEqual({ session: 'data' });
      expect(getCache('temp_data')).toBeNull();
    });
  });
});
