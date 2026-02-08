import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/session-cache.js', () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  clearCache: vi.fn(),
  CACHE_KEYS: { QUEUE_ITEMS: 'queue_items' }
}));

// Mock firebase-service
let mockAuth = { currentUser: { uid: 'user123' } };
let mockDb = null;

// Use function declarations so they evaluate at call-time, not definition-time
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; })
}));

import { getDoc, queryCollection, setDoc, updateDoc, deleteDoc, addDoc, retryOperation } from '../../utils/firestore-helpers.js';
import * as sessionCache from '../../utils/session-cache.js';

describe('firestore-helpers', () => {
  let mockCollection;
  let mockDoc;

  beforeEach(() => {
    // Reset mock auth
    mockAuth = { currentUser: { uid: 'user123' } };
    window.auth = mockAuth;

    // Mock Firestore
    mockDoc = {
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    mockCollection = {
      doc: vi.fn(() => mockDoc),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
      add: vi.fn()
    };

    mockDb = {
      collection: vi.fn(() => mockCollection)
    };

    window.db = mockDb;
    window.firebase = {
        firestore: {
            FieldValue: {
                serverTimestamp: () => 'SERVER_TIMESTAMP',
                delete: () => 'DELETE_FIELD'
            }
        }
    };

    vi.clearAllMocks();
  });

  describe('getDoc', () => {
    it('should return cached data if available', async () => {
      sessionCache.getCache.mockReturnValue({ id: 'doc1', data: 'cached' });

      const result = await getDoc('col', 'doc1', 'cacheKey');

      expect(sessionCache.getCache).toHaveBeenCalledWith('cacheKey', 'user123');
      expect(result).toEqual({ id: 'doc1', data: 'cached' });
      expect(window.db.collection).not.toHaveBeenCalled();
    });

    it('should fetch from Firestore if not cached', async () => {
      sessionCache.getCache.mockReturnValue(null);
      mockDoc.get.mockResolvedValue({
        exists: true,
        id: 'doc1',
        data: () => ({ value: 'test' })
      });

      const result = await getDoc('col', 'doc1', 'cacheKey');

      expect(window.db.collection).toHaveBeenCalledWith('col');
      expect(mockCollection.doc).toHaveBeenCalledWith('doc1');
      expect(mockDoc.get).toHaveBeenCalled();
      expect(result).toEqual({ id: 'doc1', value: 'test' });
      expect(sessionCache.setCache).toHaveBeenCalledWith('cacheKey', { id: 'doc1', value: 'test' }, 'user123');
    });

    it('should return null if doc does not exist', async () => {
      mockDoc.get.mockResolvedValue({ exists: false });
      const result = await getDoc('col', 'doc1');
      expect(result).toBeNull();
    });
  });

  describe('queryCollection', () => {
    it('should apply filters and return results', async () => {
        const mockDocs = [
            { id: '1', data: () => ({ v: 1 }) },
            { id: '2', data: () => ({ v: 2 }) }
        ];
        mockCollection.get.mockResolvedValue({ docs: mockDocs });

        const filters = [
            { field: 'status', op: '==', value: 'pending' },
            ['age', '>', 10]
        ];
        const orderBy = { field: 'createdAt', direction: 'desc' };

        const result = await queryCollection('col', { filters, orderBy, limit: 5 });

        expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'pending');
        expect(mockCollection.where).toHaveBeenCalledWith('age', '>', 10);
        expect(mockCollection.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
        expect(mockCollection.limit).toHaveBeenCalledWith(5);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: '1', v: 1 });
    });

    it('should cache results if cacheKey provided', async () => {
        const mockDocs = [{ id: '1', data: () => ({ v: 1 }) }];
        mockCollection.get.mockResolvedValue({ docs: mockDocs });

        await queryCollection('col', {}, 'cacheKey');

        expect(sessionCache.setCache).toHaveBeenCalledWith('cacheKey', [{ id: '1', v: 1 }], 'user123');
    });
  });

  describe('setDoc', () => {
      it('should set doc and update cache if single object', async () => {
          sessionCache.getCache.mockReturnValue({ id: 'doc1', old: 'val' });

          await setDoc('col', 'doc1', { new: 'val' }, { merge: true }, 'cacheKey');

          expect(mockDoc.set).toHaveBeenCalledWith({ new: 'val' }, { merge: true });
          expect(sessionCache.setCache).toHaveBeenCalledWith('cacheKey', { id: 'doc1', old: 'val', new: 'val' }, 'user123');
      });

      it('should clear cache if it is an array (list)', async () => {
          sessionCache.getCache.mockReturnValue([{ id: 'doc1' }]); // List

          await setDoc('col', 'doc1', { val: 1 }, { merge: true }, 'cacheKey');

          expect(sessionCache.clearCache).toHaveBeenCalledWith('cacheKey', 'user123');
      });
  });

  describe('updateDoc', () => {
      it('should update doc and cache', async () => {
          sessionCache.getCache.mockReturnValue({ id: 'doc1', val: 1 });

          await updateDoc('col', 'doc1', { val: 2 }, 'cacheKey');

          expect(mockDoc.update).toHaveBeenCalledWith({ val: 2 });
          expect(sessionCache.setCache).toHaveBeenCalledWith('cacheKey', { id: 'doc1', val: 2 }, 'user123');
      });
  });

  describe('addDoc', () => {
      it('should add doc and clear cache', async () => {
          mockCollection.add.mockResolvedValue({ id: 'newId' });

          const id = await addDoc('col', { val: 1 }, 'cacheKey');

          expect(mockCollection.add).toHaveBeenCalledWith({ val: 1 });
          expect(sessionCache.clearCache).toHaveBeenCalledWith('cacheKey', 'user123');
          expect(id).toBe('newId');
      });
  });

  describe('deleteDoc', () => {
      it('should delete doc and clear cache', async () => {
          await deleteDoc('col', 'doc1', 'cacheKey');

          expect(mockDoc.delete).toHaveBeenCalled();
          expect(sessionCache.clearCache).toHaveBeenCalledWith('cacheKey', 'user123');
      });
  });

  describe('retryOperation', () => {
      it('should retry on failure', async () => {
          const operation = vi.fn()
              .mockRejectedValueOnce(new Error('fail'))
              .mockResolvedValue('success');

          const result = await retryOperation(operation, 3, 10); // low delay for test

          expect(operation).toHaveBeenCalledTimes(2);
          expect(result).toBe('success');
      });

      it('should throw after max retries', async () => {
          const operation = vi.fn().mockRejectedValue(new Error('fail'));

          await expect(retryOperation(operation, 2, 1)).rejects.toThrow('fail');
          expect(operation).toHaveBeenCalledTimes(2);
      });
  });

});
