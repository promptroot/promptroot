/**
 * Centralized constants for command IDs, view IDs, and configuration keys.
 * This ensures consistency across the extension and makes refactoring easier.
 */

export const COMMANDS = {
  initialize: 'promptroot.initialize',
  openDocs: 'promptroot.openDocs',
  browseAssets: 'promptroot.browseAssets',
  refreshAssets: 'promptroot.refreshAssets',
  createAsset: 'promptroot.createAsset',
  configureJulesApi: 'promptroot.configureJulesApi',
  viewJulesSources: 'promptroot.viewJulesSources',
  viewJulesSessions: 'promptroot.viewJulesSessions',
  signIn: 'promptroot.signIn',
  signOut: 'promptroot.signOut',
  viewProfile: 'promptroot.viewProfile',
  refreshQueue: 'promptroot.refreshQueue',
  addToQueue: 'promptroot.addToQueue',
  deleteQueueItem: 'promptroot.deleteQueueItem',
  pauseQueueItem: 'promptroot.pauseQueueItem',
  resumeQueueItem: 'promptroot.resumeQueueItem',
  runQueueItem: 'promptroot.runQueueItem'
} as const;

export const VIEWS = {
  assets: 'promptroot.assetsView',
  queue: 'promptroot.queueView'
} as const;

export const CONFIG_KEYS = {
  assetsPath: 'promptroot.assetsPath',
  autoDetect: 'promptroot.autoDetect'
} as const;

export const OUTPUT_CHANNEL_NAME = 'Promptroot';
