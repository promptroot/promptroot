import { describe, it, expect } from 'vitest';
import { COMMANDS, VIEWS, CONFIG_KEYS, OUTPUT_CHANNEL_NAME } from './constants';

describe('constants', () => {
  describe('COMMANDS', () => {
    it('should have all command IDs defined', () => {
      expect(COMMANDS.initialize).toBe('promptroot.initialize');
      expect(COMMANDS.openDocs).toBe('promptroot.openDocs');
      expect(COMMANDS.browseAssets).toBe('promptroot.browseAssets');
      expect(COMMANDS.refreshAssets).toBe('promptroot.refreshAssets');
      expect(COMMANDS.createAsset).toBe('promptroot.createAsset');
      expect(COMMANDS.configureJulesApi).toBe('promptroot.configureJulesApi');
      expect(COMMANDS.viewJulesSources).toBe('promptroot.viewJulesSources');
      expect(COMMANDS.viewJulesSessions).toBe('promptroot.viewJulesSessions');
    });

    it('should have authentication command IDs', () => {
      expect(COMMANDS.signIn).toBe('promptroot.signIn');
      expect(COMMANDS.signOut).toBe('promptroot.signOut');
      expect(COMMANDS.viewProfile).toBe('promptroot.viewProfile');
    });

    it('should have queue command IDs', () => {
      expect(COMMANDS.refreshQueue).toBe('promptroot.refreshQueue');
      expect(COMMANDS.addToQueue).toBe('promptroot.addToQueue');
      expect(COMMANDS.deleteQueueItem).toBe('promptroot.deleteQueueItem');
      expect(COMMANDS.pauseQueueItem).toBe('promptroot.pauseQueueItem');
      expect(COMMANDS.resumeQueueItem).toBe('promptroot.resumeQueueItem');
      expect(COMMANDS.runQueueItem).toBe('promptroot.runQueueItem');
      expect(COMMANDS.addBatchToQueue).toBe('promptroot.addBatchToQueue');
      expect(COMMANDS.runNextPending).toBe('promptroot.runNextPending');
      expect(COMMANDS.runAllPending).toBe('promptroot.runAllPending');
      expect(COMMANDS.clearCompleted).toBe('promptroot.clearCompleted');
      expect(COMMANDS.clearFailed).toBe('promptroot.clearFailed');
      expect(COMMANDS.viewQueueItemDetails).toBe('promptroot.viewQueueItemDetails');
    });

    it('should have session command IDs', () => {
      expect(COMMANDS.refreshSessions).toBe('promptroot.refreshSessions');
      expect(COMMANDS.viewSessionDetails).toBe('promptroot.viewSessionDetails');
      expect(COMMANDS.openPRInBrowser).toBe('promptroot.openPRInBrowser');
      expect(COMMANDS.viewSessionHistory).toBe('promptroot.viewSessionHistory');
      expect(COMMANDS.filterSessions).toBe('promptroot.filterSessions');
      expect(COMMANDS.clearOldSessions).toBe('promptroot.clearOldSessions');
    });
  });

  describe('VIEWS', () => {
    it('should have all view IDs defined', () => {
      expect(VIEWS.assets).toBe('promptroot.assetsView');
      expect(VIEWS.queue).toBe('promptroot.queueView');
      expect(VIEWS.sessions).toBe('promptroot.sessionsView');
    });
  });

  describe('CONFIG_KEYS', () => {
    it('should have all config keys defined', () => {
      expect(CONFIG_KEYS.assetsPath).toBe('promptroot.assetsPath');
      expect(CONFIG_KEYS.autoDetect).toBe('promptroot.autoDetect');
    });
  });

  describe('OUTPUT_CHANNEL_NAME', () => {
    it('should have correct output channel name', () => {
      expect(OUTPUT_CHANNEL_NAME).toBe('Promptroot');
    });
  });

  describe('command namespace consistency', () => {
    it('should have all commands prefixed with promptroot', () => {
      Object.values(COMMANDS).forEach(command => {
        expect(command).toMatch(/^promptroot\./);
      });
    });

    it('should have all views prefixed with promptroot', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view).toMatch(/^promptroot\./);
      });
    });

    it('should have all config keys prefixed with promptroot', () => {
      Object.values(CONFIG_KEYS).forEach(key => {
        expect(key).toMatch(/^promptroot\./);
      });
    });
  });

  describe('command uniqueness', () => {
    it('should have unique command IDs', () => {
      const commandValues = Object.values(COMMANDS);
      const uniqueValues = new Set(commandValues);
      
      expect(commandValues.length).toBe(uniqueValues.size);
    });

    it('should have unique view IDs', () => {
      const viewValues = Object.values(VIEWS);
      const uniqueValues = new Set(viewValues);
      
      expect(viewValues.length).toBe(uniqueValues.size);
    });
  });
});
