import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addToAgenticQueue,
  updateAgenticQueueItem,
  deleteFromAgenticQueue,
  listAgenticQueue,
  subscribeToAgenticQueueUpdates
} from '../../modules/agentic-queue.js';

// Mock the service layer
vi.mock('../../modules/jules-queue-service.js', () => ({
  addToJulesQueue: vi.fn(),
  updateJulesQueueItem: vi.fn(),
  deleteFromJulesQueue: vi.fn(),
  listJulesQueue: vi.fn(),
  subscribeToQueueUpdates: vi.fn()
}));

describe('agentic-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addToAgenticQueue', () => {
    it('should add destination field defaulting to "jules"', async () => {
      const { addToJulesQueue } = await import('../../modules/jules-queue-service.js');
      addToJulesQueue.mockResolvedValue({ id: 'doc123' });

      await addToAgenticQueue('user1', {
        type: 'single',
        prompt: 'test prompt',
        sourceId: 'src/repo'
      });

      expect(addToJulesQueue).toHaveBeenCalledWith('user1', {
        type: 'single',
        prompt: 'test prompt',
        sourceId: 'src/repo',
        destination: 'jules'
      });
    });

    it('should preserve existing destination field', async () => {
      const { addToJulesQueue } = await import('../../modules/jules-queue-service.js');
      addToJulesQueue.mockResolvedValue({ id: 'doc456' });

      await addToAgenticQueue('user1', {
        type: 'single',
        prompt: 'test prompt',
        destination: 'brace'
      });

      expect(addToJulesQueue).toHaveBeenCalledWith('user1', {
        type: 'single',
        prompt: 'test prompt',
        destination: 'brace'
      });
    });

    it('should return service result', async () => {
      const { addToJulesQueue } = await import('../../modules/jules-queue-service.js');
      addToJulesQueue.mockResolvedValue({ id: 'doc789' });

      const result = await addToAgenticQueue('user1', { type: 'single', prompt: 'p' });
      expect(result).toEqual({ id: 'doc789' });
    });
  });

  describe('updateAgenticQueueItem', () => {
    it('should delegate to service updateJulesQueueItem', async () => {
      const { updateJulesQueueItem } = await import('../../modules/jules-queue-service.js');
      updateJulesQueueItem.mockResolvedValue();

      await updateAgenticQueueItem('user1', 'doc1', { status: 'done' });
      expect(updateJulesQueueItem).toHaveBeenCalledWith('user1', 'doc1', { status: 'done' });
    });
  });

  describe('deleteFromAgenticQueue', () => {
    it('should delegate to service deleteFromJulesQueue', async () => {
      const { deleteFromJulesQueue } = await import('../../modules/jules-queue-service.js');
      deleteFromJulesQueue.mockResolvedValue();

      await deleteFromAgenticQueue('user1', 'doc1');
      expect(deleteFromJulesQueue).toHaveBeenCalledWith('user1', 'doc1');
    });
  });

  describe('listAgenticQueue', () => {
    it('should delegate to service listJulesQueue', async () => {
      const { listJulesQueue } = await import('../../modules/jules-queue-service.js');
      listJulesQueue.mockResolvedValue([{ id: 'item1' }]);

      const result = await listAgenticQueue('user1');
      expect(listJulesQueue).toHaveBeenCalledWith('user1');
      expect(result).toEqual([{ id: 'item1' }]);
    });
  });

  describe('subscribeToAgenticQueueUpdates', () => {
    it('passes through to service subscribeToQueueUpdates', async () => {
      const { subscribeToQueueUpdates } = await import('../../modules/jules-queue-service.js');
      const unsubscribe = vi.fn();
      subscribeToQueueUpdates.mockReturnValue(unsubscribe);

      const callback = vi.fn();
      const result = subscribeToAgenticQueueUpdates('uid123', callback);

      expect(subscribeToQueueUpdates).toHaveBeenCalledWith('uid123', callback);
      expect(result).toBe(unsubscribe);
    });
  });
});
