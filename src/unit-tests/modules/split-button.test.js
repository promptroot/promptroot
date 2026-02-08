import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSplitButton, destroySplitButton } from '../../modules/split-button.js';

// Mock dependencies
vi.mock('../../modules/dropdown.js', () => ({
  initDropdown: vi.fn((btn, menu, container) => ({
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn()
  }))
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  createElement: vi.fn((tag, className, textContent) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }),
  createIcon: vi.fn((iconName, classes) => {
    const span = document.createElement('span');
    span.className = Array.isArray(classes) ? ['icon', ...classes].join(' ') : `icon ${classes || ''}`.trim();
    span.textContent = iconName;
    span.setAttribute('aria-hidden', 'true');
    return span;
  })
}));

describe('split-button', () => {
  let container, actionBtn, toggleBtn, menu;
  let mockOnAction;
  let defaultOptions;

  beforeEach(() => {
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Create DOM structure
    container = document.createElement('div');
    container.className = 'split-btn';
    
    actionBtn = document.createElement('button');
    actionBtn.className = 'split-btn__action';
    container.appendChild(actionBtn);
    
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'split-btn__toggle';
    container.appendChild(toggleBtn);
    
    menu = document.createElement('div');
    menu.className = 'split-btn__menu';
    container.appendChild(menu);
    
    document.body.appendChild(container);
    
    // Setup default options
    defaultOptions = [
      { value: 'option1', label: 'Option 1', icon: 'icon1' },
      { value: 'option2', label: 'Option 2', icon: 'icon2' },
      { value: 'option3', label: 'Option 3', icon: 'icon3' }
    ];
    
    mockOnAction = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initSplitButton', () => {
    it('should initialize split button with required parameters', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      expect(splitBtn).not.toBeNull();
      expect(splitBtn).toHaveProperty('destroy');
      expect(splitBtn).toHaveProperty('setSelection');
      expect(splitBtn).toHaveProperty('getSelection');
    });

    it('should return null if container is missing', () => {
      const splitBtn = initSplitButton({
        container: null,
        defaultLabel: 'Default',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      expect(splitBtn).toBeNull();
    });

    it('should return null if options are missing', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        options: null,
        onAction: mockOnAction
      });
      
      expect(splitBtn).toBeNull();
    });

    it('should return null if onAction callback is missing', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        options: defaultOptions,
        onAction: null
      });
      
      expect(splitBtn).toBeNull();
    });

    it('should return null if container missing required elements', () => {
      const badContainer = document.createElement('div');
      document.body.appendChild(badContainer);
      
      const splitBtn = initSplitButton({
        container: badContainer,
        defaultLabel: 'Default',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      expect(splitBtn).toBeNull();
    });

    it('should populate menu with options', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems.length).toBe(3);
      expect(menuItems[0].dataset.value).toBe('option1');
      expect(menuItems[1].dataset.value).toBe('option2');
      expect(menuItems[2].dataset.value).toBe('option3');
    });

    it('should set default label and icon on action button', () => {
      initSplitButton({
        container,
        defaultLabel: 'Copen',
        defaultIcon: 'open_in_new',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      expect(actionBtn.textContent).toContain('Copen');
    });

    it('should load cached selection from sessionStorage', () => {
      sessionStorage.setItem('test-storage-key', 'option2');
      
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction,
        storageKey: 'test-storage-key'
      });
      
      expect(actionBtn.textContent).toContain('Option 2');
    });
  });

  describe('action button behavior', () => {
    it('should call onAction with selected value when clicked', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction,
        storageKey: 'test-key'
      });
      
      // Set a selection first
      splitBtn.setSelection('option2');
      
      // Click action button
      actionBtn.click();
      
      expect(mockOnAction).toHaveBeenCalledWith('option2');
    });

    it('should use first option if no selection made', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      // Click action button without setting selection
      actionBtn.click();
      
      expect(mockOnAction).toHaveBeenCalledWith('option1');
    });

    it('should save selection to sessionStorage when first option is used', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction,
        storageKey: 'test-key'
      });
      
      actionBtn.click();
      
      expect(sessionStorage.getItem('test-key')).toBe('option1');
    });
  });

  describe('menu item selection', () => {
    it('should update action button when menu item clicked', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      menuItems[1].click();
      
      expect(actionBtn.textContent).toContain('Option 2');
    });

    it('should call onAction when menu item clicked', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      menuItems[2].click();
      
      expect(mockOnAction).toHaveBeenCalledWith('option3');
    });

    it('should save selection to sessionStorage when menu item clicked', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction,
        storageKey: 'test-key'
      });
      
      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      menuItems[1].click();
      
      expect(sessionStorage.getItem('test-key')).toBe('option2');
    });
  });

  describe('API methods', () => {
    it('should set selection programmatically', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction,
        storageKey: 'test-key'
      });
      
      splitBtn.setSelection('option3');
      
      expect(actionBtn.textContent).toContain('Option 3');
      expect(sessionStorage.getItem('test-key')).toBe('option3');
    });

    it('should get current selection', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      splitBtn.setSelection('option2');
      
      expect(splitBtn.getSelection()).toBe('option2');
    });

    it('should destroy split button and remove event listeners', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      splitBtn.destroy();
      
      // Click should not call onAction after destroy
      actionBtn.click();
      expect(mockOnAction).not.toHaveBeenCalled();
    });
  });

  describe('destroySplitButton', () => {
    it('should destroy split button by container reference', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      destroySplitButton(container);
      
      // Click should not call onAction after destroy
      actionBtn.click();
      expect(mockOnAction).not.toHaveBeenCalled();
    });

    it('should handle destroying non-existent split button', () => {
      const randomContainer = document.createElement('div');
      
      // Should not throw
      expect(() => destroySplitButton(randomContainer)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle options without icons', () => {
      const optionsNoIcons = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2' }
      ];
      
      initSplitButton({
        container,
        defaultLabel: 'Default',
        options: optionsNoIcons,
        onAction: mockOnAction
      });
      
      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems.length).toBe(2);
      expect(menuItems[0].textContent).toContain('Option 1');
    });

    it('should handle setSelection with invalid value', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      const initialLabel = actionBtn.textContent;
      splitBtn.setSelection('invalid-option');
      
      // Should not change selection
      expect(actionBtn.textContent).toBe(initialLabel);
    });

    it('should handle click on menu itself (not menu item)', () => {
      initSplitButton({
        container,
        defaultLabel: 'Default',
        defaultIcon: 'default_icon',
        options: defaultOptions,
        onAction: mockOnAction
      });
      
      // Click on menu directly
      menu.click();
      
      // Should not call onAction
      expect(mockOnAction).not.toHaveBeenCalled();
    });
  });
});
