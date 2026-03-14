import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initServices,
  getAuth,
  getDb,
  getFunctions,
  onFirebaseReady,
  resetServices
} from '../../modules/firebase-service.js';

describe('firebase-service', () => {
  beforeEach(() => {
    resetServices();
  });

  describe('initialization and getters', () => {
    it('should return null for services before initialization', () => {
      const auth = getAuth();
      const db = getDb();
      const functions = getFunctions();

      expect(auth).toBeNull();
      expect(db).toBeNull();
      expect(functions).toBeNull();
    });

    it('should warn when accessing Auth or DB before initialization', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      getAuth();
      expect(warnSpy).toHaveBeenCalledWith('Firebase Auth accessed before initialization');

      getDb();
      expect(warnSpy).toHaveBeenCalledWith('Firebase DB accessed before initialization');

      warnSpy.mockRestore();
    });

    it('should initialize services and return them via getters', () => {
      const mockAuth = { name: 'auth' };
      const mockDb = { name: 'db' };
      const mockFunctions = { name: 'functions' };

      initServices(mockAuth, mockDb, mockFunctions);

      expect(getAuth()).toBe(mockAuth);
      expect(getDb()).toBe(mockDb);
      expect(getFunctions()).toBe(mockFunctions);
    });
  });

  describe('onFirebaseReady', () => {
    it('should queue and execute callbacks after initialization', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      onFirebaseReady(callback1);
      onFirebaseReady(callback2);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      initServices({}, {}, {});

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should execute callback immediately if already ready', () => {
      initServices({}, {}, {});
      const callback = vi.fn();

      onFirebaseReady(callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should handle errors in callbacks and continue', () => {
      const errorCallback = vi.fn(() => { throw new Error('Test Error'); });
      const successCallback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      onFirebaseReady(errorCallback);
      onFirebaseReady(successCallback);

      initServices({}, {}, {});

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in firebase ready callback:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle errors in immediate callbacks', () => {
      initServices({}, {}, {});
      const errorCallback = vi.fn(() => { throw new Error('Immediate Test Error'); });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      onFirebaseReady(errorCallback);

      expect(errorCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in firebase ready callback:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
