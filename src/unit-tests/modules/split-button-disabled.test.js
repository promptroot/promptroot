import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSplitButton } from '../../modules/split-button.js';

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

describe('split-button disabled support', () => {
  let container, actionBtn, toggleBtn, menu;
  let mockOnAction;
  let optionsWithDisabled;

  beforeEach(() => {
    sessionStorage.clear();

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

    optionsWithDisabled = [
      { value: 'jules', label: 'Jules', icon: 'smart_toy' },
      { value: 'brace', label: 'Brace (not configured)', icon: 'hub', disabled: true }
    ];

    mockOnAction = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('disabled option rendering', () => {
    it('should add aria-disabled="true" to disabled menu items', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('true');
    });

    it('should add data-disabled="true" to disabled menu items', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems[1].dataset.disabled).toBe('true');
    });

    it('should add disabled class to disabled menu items', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems[1].classList.contains('split-btn__menu-item--disabled')).toBe(true);
    });

    it('should not add disabled attributes to enabled items', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems[0].getAttribute('aria-disabled')).toBeNull();
      expect(menuItems[0].dataset.disabled).toBeUndefined();
      expect(menuItems[0].classList.contains('split-btn__menu-item--disabled')).toBe(false);
    });
  });

  describe('clicking disabled items', () => {
    it('should not fire onAction when clicking disabled menu item', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      menuItems[1].click();

      expect(mockOnAction).not.toHaveBeenCalled();
    });

    it('should fire onAction when clicking enabled menu item', () => {
      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction
      });

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      menuItems[0].click();

      expect(mockOnAction).toHaveBeenCalledWith('jules');
    });
  });

  describe('storage fallback for disabled options', () => {
    it('should fall back to first non-disabled option when stored option is disabled', () => {
      sessionStorage.setItem('test-agent-key', 'brace');

      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction,
        storageKey: 'test-agent-key'
      });

      // The action button should show the first non-disabled option (jules), not brace
      expect(actionBtn.textContent).toContain('Jules');
    });

    it('should use stored option when it is not disabled', () => {
      sessionStorage.setItem('test-agent-key', 'jules');

      initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: optionsWithDisabled,
        onAction: mockOnAction,
        storageKey: 'test-agent-key'
      });

      expect(actionBtn.textContent).toContain('Jules');
    });
  });

  describe('updateOptions with disabled', () => {
    it('should rebuild menu with disabled options when updateOptions called', () => {
      const splitBtn = initSplitButton({
        container,
        defaultLabel: 'Run in Agent',
        defaultIcon: 'smart_toy',
        options: [
          { value: 'jules', label: 'Jules', icon: 'smart_toy' },
          { value: 'brace', label: 'Brace', icon: 'hub' }
        ],
        onAction: mockOnAction
      });

      // Update with brace disabled
      splitBtn.updateOptions(optionsWithDisabled);

      const menuItems = menu.querySelectorAll('.split-btn__menu-item');
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('true');
      expect(menuItems[1].classList.contains('split-btn__menu-item--disabled')).toBe(true);
    });
  });
});
