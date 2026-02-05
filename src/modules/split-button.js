/**
 * Split Button Component
 * A reusable button component similar to GitHub's "Close issue" button.
 * Features a main action button and a dropdown toggle for selecting options.
 * 
 * Example usage:
 *   initSplitButton({
 *     container: document.querySelector('.split-btn-container'),
 *     defaultLabel: 'Copen',
 *     defaultIcon: 'open_in_new',
 *     options: [
 *       { value: 'claude', label: 'Claude', icon: 'smart_toy' },
 *       { value: 'chatgpt', label: 'ChatGPT', icon: 'chat' }
 *     ],
 *     onAction: (selectedValue) => { ... },
 *     storageKey: 'copen-last-selection'
 *   });
 */

import { initDropdown } from './dropdown.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';

const activeButtons = new Map();

const SELECTORS = {
  ACTION: '.split-btn__action',
  TOGGLE: '.split-btn__toggle',
  MENU: '.split-btn__menu',
  MENU_ITEM: '.split-btn__menu-item'
};

const CLASSES = {
  MENU_ITEM: 'split-btn__menu-item'
};

/**
 * Initialize a split button
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.container - Container element with .split-btn structure
 * @param {string} config.defaultLabel - Default label for the main button
 * @param {string} [config.defaultIcon] - Default icon for the main button
 * @param {Array} config.options - Array of option objects {value, label, icon}
 * @param {Function} config.onAction - Callback when action button is clicked (value) => void
 * @param {string} [config.storageKey] - SessionStorage key for remembering last selection
 * @returns {Object} - API for controlling the split button
 */
export function initSplitButton(config) {
  const {
    container,
    defaultLabel,
    defaultIcon,
    options: initialOptions,
    onAction,
    storageKey
  } = config;

  if (!container || !initialOptions || !onAction) {
    console.error('Split button requires container, options, and onAction');
    return null;
  }

  const actionBtn = container.querySelector(SELECTORS.ACTION);
  const toggleBtn = container.querySelector(SELECTORS.TOGGLE);
  const menu = container.querySelector(SELECTORS.MENU);

  if (!actionBtn || !toggleBtn || !menu) {
    console.error('Split button container missing required child elements');
    return null;
  }

  // Store current options (mutable)
  let options = [...initialOptions];

  // Load last selection from storage if available
  let currentSelection = null;
  if (storageKey) {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      const storedOption = options.find(opt => opt.value === stored);
      if (storedOption) {
        currentSelection = storedOption;
      }
    }
  }

  // Set initial state
  if (!currentSelection) {
    currentSelection = {
      value: null,
      label: defaultLabel,
      icon: defaultIcon
    };
  }

  updateActionButton(actionBtn, currentSelection);

  // Build initial menu
  rebuildMenu(menu, options);

  const dropdown = initDropdown(toggleBtn, menu, container);
  
  if (!dropdown) {
    console.error('Failed to initialize dropdown for split button');
    return null;
  }

  // Handle action button clicks
  const handleAction = () => {
    const value = currentSelection.value || options[0]?.value;
    if (value) {
      // If no previous selection, use the first option and save it
      if (!currentSelection.value && options[0]) {
        currentSelection = options[0];
        updateActionButton(actionBtn, options[0]);
        if (storageKey) {
          sessionStorage.setItem(storageKey, options[0].value);
        }
      }
      onAction(value);
    }
  };

  actionBtn.addEventListener('click', handleAction);

  // Handle menu item clicks
  const handleMenuClick = (e) => {
    const item = e.target.closest('.split-btn__menu-item');
    if (!item) return;

    const value = item.dataset.value;
    const option = options.find(opt => opt.value === value);
    
    if (option) {
      currentSelection = option;
      updateActionButton(actionBtn, option);
      
      // Save to storage
      if (storageKey) {
        sessionStorage.setItem(storageKey, option.value);
      }
      
      // Execute action
      onAction(option.value);
      
      // Close dropdown
      if (dropdown) {
        dropdown.close();
      }
    }
  };

  menu.addEventListener('click', handleMenuClick);

  const api = {
    destroy: () => {
      actionBtn.removeEventListener('click', handleAction);
      menu.removeEventListener('click', handleMenuClick);
      activeButtons.delete(container);
    },
    
    setSelection: (value) => {
      const option = options.find(opt => opt.value === value);
      if (option) {
        currentSelection = option;
        updateActionButton(actionBtn, option);
        if (storageKey) {
          sessionStorage.setItem(storageKey, option.value);
        }
      }
    },
    
    getSelection: () => currentSelection.value,
    
    updateOptions: (newOptions) => {
      options = [...newOptions];
      rebuildMenu(menu, options);
      
      // If there's a stored selection and we didn't have it before, update the button
      if (storageKey && !currentSelection.value && options.length > 0) {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const storedOption = options.find(opt => opt.value === stored);
          if (storedOption) {
            currentSelection = storedOption;
            updateActionButton(actionBtn, storedOption);
          }
        }
      }
    }
  };

  activeButtons.set(container, api);
  return api;
}

/**
 * Update the action button's label and icon
 */
function updateActionButton(button, option) {
  button.innerHTML = '';
  
  if (option.icon) {
    button.appendChild(createIcon(option.icon, 'icon-inline'));
  }
  
  const label = createElement('span', '', option.label);
  button.appendChild(label);
}

/**
 * Rebuild menu items
 */
function rebuildMenu(menu, options) {
  menu.innerHTML = '';
  options.forEach(option => {
    const item = createElement('div', CLASSES.MENU_ITEM);
    item.dataset.value = option.value;
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '-1');
    
    if (option.icon) {
      item.appendChild(createIcon(option.icon, 'icon-inline'));
    }
    
    const label = createElement('span', '', option.label);
    item.appendChild(label);
    
    menu.appendChild(item);
  });
}

/**
 * Destroy a split button instance
 */
export function destroySplitButton(container) {
  const api = activeButtons.get(container);
  if (api) {
    api.destroy();
  }
}

/**
 * Update options for an existing split button
 * @param {HTMLElement} container - Container element
 * @param {Array} newOptions - New array of options
 */
export function updateSplitButtonOptions(container, newOptions) {
  const api = activeButtons.get(container);
  if (!api || !newOptions) return;
  
  api.updateOptions(newOptions);
}
