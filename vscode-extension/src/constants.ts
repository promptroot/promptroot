/**
 * Centralized constants for command IDs, view IDs, and configuration keys.
 * This ensures consistency across the extension and makes refactoring easier.
 */

export const COMMANDS = {
  initialize: 'promptroot.initialize',
  openDocs: 'promptroot.openDocs',
  browseAssets: 'promptroot.browseAssets'
} as const;

export const VIEWS = {
  assets: 'promptroot.assetsView'
} as const;

export const CONFIG_KEYS = {
  assetsPath: 'promptroot.assetsPath',
  autoDetect: 'promptroot.autoDetect'
} as const;

export const OUTPUT_CHANNEL_NAME = 'Promptroot';
