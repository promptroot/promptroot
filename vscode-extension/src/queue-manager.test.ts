/**
 * Queue Manager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { QueueManager } from './queue-manager';
import { FirestoreService } from './firestore-service';
import { AuthManager } from './auth-manager';
import { JulesClient } from './jules-client';
import { JulesConfig } from './jules-config';
import { GitHubService } from './github-service';
import { Timestamp } from 'firebase/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Mock Node.js modules
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('path', async () => {
  const actual = await vi.importActual('path') as any;
  return {
    ...actual,
    isAbsolute: vi.fn(),
    join: vi.fn(),
  };
});

// Mock Firestore Timestamp
vi.mock('firebase/firestore', () => ({
  Timestamp: {
    now: vi.fn(() => ({ seconds: 123456789, nanoseconds: 0 })),
    fromDate: vi.fn((date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
  },
}));

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let mockFirestoreService: any;
  let mockAuthManager: any;
  let mockJulesClient: any;
  let mockJulesConfig: any;
  let mockGitHubService: any;
  let mockOutputChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFirestoreService = {
      addQueueItem: vi.fn(),
      deleteQueueItem: vi.fn(),
      updateQueueItem: vi.fn(),
      getQueueItems: vi.fn(),
    };

    mockAuthManager = {
      getCurrentUser: vi.fn(),
    };

    mockJulesClient = {
      listAllSources: vi.fn(),
      listAllSessions: vi.fn(),
      createSession: vi.fn(),
    };

    mockJulesConfig = {
      getApiKey: vi.fn(),
    };

    mockGitHubService = {
      getRepository: vi.fn(),
      listBranches: vi.fn(),
    };

    mockOutputChannel = {
      appendLine: vi.fn(),
    };

    queueManager = new QueueManager(
      mockFirestoreService,
      mockAuthManager,
      mockJulesClient,
      mockJulesConfig,
      mockGitHubService,
      mockOutputChannel
    );

    // Mock VS Code workspace folders
    (vscode.workspace as any).workspaceFolders = [{
      uri: { fsPath: '/test/workspace' },
      name: 'test',
      index: 0
    }];
  });

  describe('addToQueue', () => {
    it('should add a single prompt to queue', async () => {
      const promptPath = 'prompts/test.prompt';
      const branch = 'main';
      const content = 'test content';
      const userId = 'user123';
      const queueItemId = 'queue123';

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
      (fs.promises.readFile as any).mockResolvedValue(content);
      (path.isAbsolute as any).mockReturnValue(false);
      (path.join as any).mockReturnValue('/test/workspace/prompts/test.prompt');
      mockFirestoreService.addQueueItem.mockResolvedValue(queueItemId);

      const result = await queueManager.addToQueue(promptPath, branch);

      expect(result).toBe(queueItemId);
      expect(fs.promises.readFile).toHaveBeenCalledWith('/test/workspace/prompts/test.prompt', 'utf8');
      expect(mockFirestoreService.addQueueItem).toHaveBeenCalledWith(userId, expect.objectContaining({
        type: 'single',
        promptPath,
        prompt: content,
        branch,
      }));
    });

    it('should throw error if user not signed in', async () => {
      mockAuthManager.getCurrentUser.mockReturnValue(null);

      await expect(queueManager.addToQueue('path', 'branch')).rejects.toThrow('User not signed in');
    });
  });

  describe('addBatchToQueue', () => {
    it('should add multiple prompts to queue as batch', async () => {
      const promptPaths = ['p1', 'p2'];
      const branch = 'main';
      const userId = 'user123';
      const batchId = 'batch123';

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
      (vscode.workspace.fs.readFile as any).mockImplementation((uri: any) => {
        return Promise.resolve(Buffer.from(`content for ${uri.path}`));
      });
      mockFirestoreService.addQueueItem.mockResolvedValue(batchId);

      const result = await queueManager.addBatchToQueue(promptPaths, branch);

      expect(result).toBe(batchId);
      expect(mockFirestoreService.addQueueItem).toHaveBeenCalledWith(userId, expect.objectContaining({
        type: 'subtasks',
        remaining: [
          { fullContent: 'content for p1', status: 'pending' },
          { fullContent: 'content for p2', status: 'pending' }
        ],
        totalCount: 2
      }));
    });

    it('should handle file read errors in batch', async () => {
      const promptPaths = ['p1'];
      const branch = 'main';
      const userId = 'user123';

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
      (vscode.workspace.fs.readFile as any).mockRejectedValue(new Error('Read error'));
      mockFirestoreService.addQueueItem.mockResolvedValue('batch123');

      await queueManager.addBatchToQueue(promptPaths, branch);

      expect(mockFirestoreService.addQueueItem).toHaveBeenCalledWith(userId, expect.objectContaining({
        remaining: [
          expect.objectContaining({ status: 'failed', error: expect.stringContaining('Read error') })
        ]
      }));
    });
  });

  describe('Queue Item Operations', () => {
    const userId = 'user123';
    const itemId = 'item123';

    beforeEach(() => {
      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
    });

    it('should delete queue item', async () => {
      await queueManager.deleteQueueItem(itemId);
      expect(mockFirestoreService.deleteQueueItem).toHaveBeenCalledWith(userId, itemId);
    });

    it('should pause queue item', async () => {
      await queueManager.pauseQueueItem(itemId);
      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'paused'
      }));
    });

    it('should resume queue item', async () => {
      await queueManager.resumeQueueItem(itemId);
      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'pending'
      }));
    });

    it('should schedule queue item', async () => {
      const date = new Date();
      await queueManager.scheduleQueueItem(itemId, date);
      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'scheduled'
      }));
    });
  });

  describe('runQueueItem', () => {
    it('should run a single queue item successfully', async () => {
      const userId = 'user123';
      const itemId = 'item123';
      const queueItem = {
        id: itemId,
        type: 'single',
        status: 'pending',
        prompt: 'test prompt',
        branch: 'main'
      };

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
      mockFirestoreService.getQueueItems.mockResolvedValue([queueItem]);
      mockJulesConfig.getApiKey.mockResolvedValue('api-key');
      mockJulesClient.listAllSources.mockResolvedValue([{ name: 'repo1', displayName: 'Repo 1' }]);
      (vscode.window.showQuickPick as any).mockResolvedValue('Yes'); // For repository confirmation
      mockJulesClient.createSession.mockResolvedValue({ name: 'session1' });

      await queueManager.runQueueItem(itemId);

      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'running'
      }));
      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'completed'
      }));
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Completed queue item'));
    });

    it('should handle errors during execution', async () => {
      const userId = 'user123';
      const itemId = 'item123';
      const errorMsg = 'API Error';

      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
      mockFirestoreService.getQueueItems.mockResolvedValue([{ id: itemId, status: 'pending' }]);
      mockJulesConfig.getApiKey.mockRejectedValue(new Error(errorMsg));

      await queueManager.runQueueItem(itemId);

      expect(mockFirestoreService.updateQueueItem).toHaveBeenCalledWith(userId, itemId, expect.objectContaining({
        status: 'failed',
        lastError: expect.objectContaining({ message: errorMsg })
      }));
    });
  });

  describe('Batch Operations', () => {
    const userId = 'user123';

    beforeEach(() => {
      mockAuthManager.getCurrentUser.mockReturnValue({ uid: userId });
    });

    it('should run next pending item', async () => {
      const items = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'pending' },
        { id: '3', status: 'pending' }
      ];

      // Spy on runQueueItem
      const runQueueItemSpy = vi.spyOn(queueManager, 'runQueueItem').mockResolvedValue(undefined);

      await queueManager.runNextPending(items as any);

      expect(runQueueItemSpy).toHaveBeenCalledWith('2');
    });

    it('should run all pending items', async () => {
      const items = [
        { id: '1', status: 'pending', type: 'single', promptPath: 'p1' },
        { id: '2', status: 'pending', type: 'single', promptPath: 'p2' }
      ];

      (vscode.window.showWarningMessage as any).mockResolvedValue('Run All');
      (vscode.window.withProgress as any).mockImplementation((options: any, task: any) => {
        return task({ report: vi.fn() });
      });

      const runQueueItemSpy = vi.spyOn(queueManager, 'runQueueItem').mockResolvedValue(undefined);

      await queueManager.runAllPending(items as any);

      expect(runQueueItemSpy).toHaveBeenCalledTimes(2);
      expect(runQueueItemSpy).toHaveBeenCalledWith('1');
      expect(runQueueItemSpy).toHaveBeenCalledWith('2');
    });

    it('should clear completed items', async () => {
      const items = [
        { id: '1', status: 'completed' },
        { id: '2', status: 'pending' }
      ];

      (vscode.window.showWarningMessage as any).mockResolvedValue('Delete All');

      await queueManager.clearCompleted(items as any);

      expect(mockFirestoreService.deleteQueueItem).toHaveBeenCalledTimes(1);
      expect(mockFirestoreService.deleteQueueItem).toHaveBeenCalledWith(userId, '1');
    });

    it('should clear failed items', async () => {
      const items = [
        { id: '1', status: 'failed' },
        { id: '2', status: 'pending' }
      ];

      (vscode.window.showWarningMessage as any).mockResolvedValue('Delete All');

      await queueManager.clearFailed(items as any);

      expect(mockFirestoreService.deleteQueueItem).toHaveBeenCalledTimes(1);
      expect(mockFirestoreService.deleteQueueItem).toHaveBeenCalledWith(userId, '1');
    });
  });
});
