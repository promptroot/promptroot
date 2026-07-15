/**
 * Icon generation utilities for Material Symbols
 */

/**
 * Generate an icon span element
 * @param {string} iconName - Material Symbol icon name
 * @param {object} options - Configuration options
 * @param {string} options.size - 'inline' | 'lg' | 'xl' | null (default 24px)
 * @param {string} options.className - Additional CSS classes
 * @param {string} options.title - Accessible title
 * @returns {string} HTML string for icon
 */
export function createIcon(iconName, options = {}) {
  const { size = null, className = '', title = '' } = options;
  
  const classes = ['icon'];
  if (size) classes.push(`icon-${size}`);
  if (className) classes.push(className);
  
  const titleAttr = title ? ` title="${title}"` : '';
  
  return `<span class="${classes.join(' ')}" aria-hidden="true"${titleAttr}>${iconName}</span>`;
}

/**
 * Generate an icon with text label
 * @param {string} iconName - Material Symbol icon name
 * @param {string} text - Text label
 * @param {object} options - Same as createIcon options
 * @returns {string} HTML string for icon + text
 */
export function createIconWithText(iconName, text, options = {}) {
  const iconOptions = { size: 'inline', ...options };
  return `${createIcon(iconName, iconOptions)} ${text}`;
}

/**
 * Generate a button with icon
 * @param {string} iconName - Material Symbol icon name
 * @param {string} text - Button text (optional, for icon-only use '')
 * @param {object} options - Button configuration
 * @returns {string} HTML string for button
 */
export function createIconButton(iconName, text = '', options = {}) {
  const { iconSize = 'inline' } = options;
  
  if (text) {
    return `<span class="icon icon-${iconSize}" aria-hidden="true">${iconName}</span> ${text}`;
  } else {
    // Icon-only button
    return `<span class="icon" aria-hidden="true">${iconName}</span>`;
  }
}

/**
 * Common icon button configurations
 */
export const ICON_BUTTONS = {
  COPY_PROMPT: (iconName = 'content_copy') => createIconWithText(iconName, 'Copy prompt'),
  COPY_LINK: (iconName = 'link') => createIconWithText(iconName, 'Copy link'),
  EDIT: (iconName = 'edit') => createIconWithText(iconName, 'Edit'),
  DELETE: (iconName = 'delete') => createIconWithText(iconName, 'Delete'),
  SYNC: (iconName = 'sync') => createIcon(iconName), // Icon-only
  CLOSE: (iconName = 'close') => createIcon(iconName), // Icon-only
  LOADING: (iconName = 'hourglass_top') => createIconWithText(iconName, 'Loading...'),
  SUCCESS: (iconName = 'check_circle') => createIconWithText(iconName, 'Success'),
  ERROR: (iconName = 'error') => createIconWithText(iconName, 'Error'),
};

/**
 * Icon name constants for consistency
 */
export const ICONS = {
  // Actions
  COPY: 'content_copy',
  LINK: 'link',
  EDIT: 'edit',
  DELETE: 'delete',
  ADD: 'add',
  CLOSE: 'close',
  SYNC: 'sync',
  REFRESH: 'refresh',
  
  // Status
  CHECK: 'check_circle',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'hourglass_top',
  CANCEL: 'cancel',
  
  // Navigation
  HOME: 'home',
  BACK: 'arrow_back',
  MENU: 'menu',
  
  // Content
  FOLDER: 'folder',
  FILE: 'description',
  CODE: 'code',
  PHOTO: 'photo_camera',
  KEY: 'key',
  LOCK: 'lock',
  
  // App Specific
  JULES: 'smart_toy',
  QUEUE: 'list_alt',
  SESSIONS: 'menu_book',
  PROFILE: 'person',
  REPO: 'inventory_2',
  BRANCH: 'account_tree',
  
  // Features
  FREE_INPUT: 'edit_note',
  CHAT: 'chat_bubble',
  PUBLIC: 'public',
  FORUM: 'forum',
  MAGIC: 'auto_awesome',
  VISIBILITY: 'visibility',
};
