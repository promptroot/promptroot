import { describe, it, expect } from 'vitest';
import {
  isSingleQueueItem,
  isBatchQueueItem,
  getUserCollectionPath,
  COLLECTIONS,
  JulesQueueItem,
  SingleQueueItem,
  BatchQueueItem,
  SessionStatus
} from './models';
import { Timestamp } from 'firebase/firestore';

describe('models', () => {
  describe('type guards', () => {
    describe('isSingleQueueItem', () => {
      it('should return true for single queue items', () => {
        const item: SingleQueueItem = {
          id: 'test-1',
          type: 'single',
          status: 'pending',
          promptPath: '/test/prompt.md',
          prompt: 'Test prompt content',
          sourceId: 'test-source',
          branch: 'main',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        expect(isSingleQueueItem(item)).toBe(true);
      });

      it('should return false for batch queue items', () => {
        const item: BatchQueueItem = {
          id: 'test-2',
          type: 'subtasks',
          status: 'pending',
          sourceId: 'test-source',
          branch: 'main',
          remaining: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        expect(isSingleQueueItem(item)).toBe(false);
      });
    });

    describe('isBatchQueueItem', () => {
      it('should return true for batch queue items', () => {
        const item: BatchQueueItem = {
          id: 'test-2',
          type: 'subtasks',
          status: 'pending',
          sourceId: 'test-source',
          branch: 'main',
          remaining: [
            { fullContent: 'Test content 1' },
            { fullContent: 'Test content 2' }
          ],
          totalCount: 2,
          completedCount: 0,
          failedCount: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        expect(isBatchQueueItem(item)).toBe(true);
      });

      it('should return false for single queue items', () => {
        const item: SingleQueueItem = {
          id: 'test-1',
          type: 'single',
          status: 'pending',
          promptPath: '/test/prompt.md',
          prompt: 'Test prompt content',
          sourceId: 'test-source',
          branch: 'main',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        expect(isBatchQueueItem(item)).toBe(false);
      });
    });
  });

  describe('getUserCollectionPath', () => {
    it('should return correct path for queue collection', () => {
      const uid = 'user123';
      const path = getUserCollectionPath(uid, 'queue');
      
      expect(path).toBe('julesQueues/user123/items');
    });

    it('should return correct path for sessions collection', () => {
      const uid = 'user123';
      const path = getUserCollectionPath(uid, 'sessions');
      
      expect(path).toBe('juleSessions/user123/sessions');
    });

    it('should return correct path for other collections', () => {
      const uid = 'user123';
      const path = getUserCollectionPath(uid, 'customCollection');
      
      expect(path).toBe('customCollection/user123');
    });
  });

  describe('COLLECTIONS constants', () => {
    it('should have correct collection names', () => {
      expect(COLLECTIONS.USERS).toBe('users');
      expect(COLLECTIONS.API_KEYS).toBe('apiKeys');
      expect(COLLECTIONS.JULES_QUEUES).toBe('julesQueues');
      expect(COLLECTIONS.QUEUE_ITEMS).toBe('items');
      expect(COLLECTIONS.JULES_SESSIONS).toBe('juleSessions');
      expect(COLLECTIONS.SESSIONS).toBe('sessions');
      expect(COLLECTIONS.REPO_PREFERENCES).toBe('repoPreferences');
    });
  });

  describe('Status types', () => {
    it('should accept valid queue statuses', () => {
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'paused', 'scheduled'];
      validStatuses.forEach(status => {
        const item: JulesQueueItem = {
          id: 'test',
          type: 'single',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: status as any,
          promptPath: '/test.md',
          prompt: 'test',
          sourceId: 'test',
          branch: 'main',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        expect(item.status).toBe(status);
      });
    });

    it('should accept valid session statuses', () => {
      const validStatuses: SessionStatus[] = [
        'COMPLETED',
        'FAILED',
        'IN_PROGRESS',
        'PLANNING',
        'QUEUED',
        'PAUSED'
      ];
      
      validStatuses.forEach(status => {
        expect(status).toBeTruthy();
      });
    });
  });
});
