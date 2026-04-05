import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as folderSubmenu from '../../modules/folder-submenu.js';
import { FOLDER_SUBMENU_TEXT } from '../../utils/constants.js';

// Mock the constants
vi.mock('../../utils/constants.js', () => ({
  FOLDER_SUBMENU_TEXT: {
    NEW_PROMPT: 'New Prompt',
    NEW_CONVERSATION: 'New Conversation',
    ACTIONS: {
      CREATE_PROMPT: 'create-prompt',
      CREATE_CONVERSATION: 'create-conversation'
    },
    NEW_PROMPT_FILENAME_PREFIX: 'prompt-',
    CONVERSATION_TEMPLATE: 'Conversation Template Data',
    NEW_CONVERSATION_FILENAME: 'conversation.md'
  }
}));

// Mock icon helpers
vi.mock('../../utils/icon-helpers.js', () => ({
  ICONS: {
    FREE_INPUT: 'FREE_INPUT_ICON',
    CHAT: 'CHAT_ICON'
  },
  createIcon: vi.fn().mockImplementation((icon) => `<span class="icon">${icon}</span>`)
}));

describe('folder-submenu', () => {
  let mockWindowOpen;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Mock Date for predictable filenames
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2023, 4, 15, 12, 30)); // May 15, 2023, 12:30

    // Mock window.open
    mockWindowOpen = vi.fn();
    vi.stubGlobal('open', mockWindowOpen);

    // Reset window width/height for positioning calculations
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  });

  afterEach(() => {
    folderSubmenu.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('setContext', () => {
    it('should set internal context variables properly', () => {
      folderSubmenu.setContext('testOwner', 'testRepo', 'testBranch');
      // Since context variables are private, we can only verify their effect
      // when creating URLs later. But we can verify the function doesn't throw.
      expect(typeof folderSubmenu.setContext).toBe('function');
    });
  });

  describe('init & DOM creation', () => {
    it('should create submenu DOM element when init is called', () => {
      folderSubmenu.init();

      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl).not.toBeNull();
      expect(submenuEl.getAttribute('role')).toBe('menu');

      const items = submenuEl.querySelectorAll('.folder-submenu-item');
      expect(items.length).toBe(2);
      expect(items[0].dataset.action).toBe(FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT);
      expect(items[1].dataset.action).toBe(FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_CONVERSATION);
    });

    it('should only create one submenu element if init is called multiple times', () => {
      folderSubmenu.init();
      folderSubmenu.init();

      const submenus = document.querySelectorAll('.folder-submenu');
      expect(submenus.length).toBe(1);
    });

    it('should attach keydown and click event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      folderSubmenu.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should update currentBranch when branchChanged event is fired', () => {
      folderSubmenu.init();
      folderSubmenu.setContext('testOwner', 'testRepo', 'main');

      // We will verify the branch change by triggering an action that uses the branch
      const event = new CustomEvent('branchChanged', { detail: { branch: 'feature-branch' } });
      window.dispatchEvent(event);

      // Simulate click on create prompt to see which branch it uses
      folderSubmenu.toggle(document.createElement('div'), '');

      const submenuEl = document.querySelector('.folder-submenu');
      submenuEl.classList.add('folder-submenu--visible'); // Force visible for test

      const createPromptItem = document.querySelector(`[data-action="${FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT}"]`);

      // Trigger click
      createPromptItem.click();

      // Check the URL has the new branch
      expect(mockWindowOpen).toHaveBeenCalled();
      const url = mockWindowOpen.mock.calls[0][0];
      expect(url).toContain('testOwner/testRepo/new/feature-branch');
      expect(url).toContain('ref=feature-branch');
    });
  });

  describe('toggle and visibility', () => {
    let triggerElement;
    let headerElement;

    beforeEach(() => {
      folderSubmenu.init();

      // Create a mock trigger structure
      headerElement = document.createElement('div');
      headerElement.className = 'tree-dir';

      triggerElement = document.createElement('button');
      triggerElement.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 100,
        right: 200,
        bottom: 120,
        left: 180,
        width: 20,
        height: 20
      });

      headerElement.appendChild(triggerElement);
      document.body.appendChild(headerElement);
    });

    it('should open the submenu and position it correctly', () => {
      folderSubmenu.toggle(triggerElement, 'test/path');

      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(true);
      expect(submenuEl.dataset.currentPath).toBe('test/path');

      // Check positioning styles (left: rect.right, top: rect.top)
      expect(submenuEl.style.getPropertyValue('--submenu-left')).toBe('200px');
      expect(submenuEl.style.getPropertyValue('--submenu-top')).toBe('100px');

      expect(triggerElement.getAttribute('aria-expanded')).toBe('true');
      expect(headerElement.classList.contains('submenu-open')).toBe(true);
    });

    it('should close the submenu if toggle is called while it is open for the same path', () => {
      folderSubmenu.toggle(triggerElement, 'test/path'); // open

      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(true);

      folderSubmenu.toggle(triggerElement, 'test/path'); // close

      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(false);
      expect(triggerElement.getAttribute('aria-expanded')).toBe('false');
      expect(headerElement.classList.contains('submenu-open')).toBe(false);
    });

    it('should open the submenu for a different path if called while open', () => {
      folderSubmenu.toggle(triggerElement, 'test/path1'); // open 1

      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.dataset.currentPath).toBe('test/path1');

      folderSubmenu.toggle(triggerElement, 'test/path2'); // close 1, open 2

      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(true);
      expect(submenuEl.dataset.currentPath).toBe('test/path2');
    });

    it('should adjust positioning if submenu goes out of bounds right', () => {
      // Submenu will definitely go out of bounds on right
      triggerElement.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 100,
        right: 1020, // Near 1024 right edge
        bottom: 120,
        left: 1000,
        width: 20,
        height: 20
      });

      // Mock submenu dimensions
      const submenuEl = document.querySelector('.folder-submenu');
      vi.spyOn(submenuEl, 'getBoundingClientRect').mockReturnValue({
        width: 150,
        height: 100,
        top: 0, right: 0, bottom: 0, left: 0
      });

      folderSubmenu.toggle(triggerElement, 'test/path');

      // left = rect.left - submenuRect.width = 1000 - 150 = 850
      expect(submenuEl.style.getPropertyValue('--submenu-left')).toBe('850px');
    });

    it('should adjust positioning if submenu goes out of bounds bottom', () => {
      // Submenu will definitely go out of bounds on bottom
      triggerElement.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 750, // Near 768 bottom edge
        right: 200,
        bottom: 770,
        left: 180,
        width: 20,
        height: 20
      });

      const submenuEl = document.querySelector('.folder-submenu');
      vi.spyOn(submenuEl, 'getBoundingClientRect').mockReturnValue({
        width: 150,
        height: 100,
        top: 0, right: 0, bottom: 0, left: 0
      });

      folderSubmenu.toggle(triggerElement, 'test/path');

      // top = rect.bottom - submenuRect.height = 770 - 100 = 670
      expect(submenuEl.style.getPropertyValue('--submenu-top')).toBe('670px');
    });
  });

  describe('interactions', () => {
    let triggerElement;

    beforeEach(() => {
      folderSubmenu.init();
      folderSubmenu.setContext('owner1', 'repo1', 'branch1');

      triggerElement = document.createElement('button');
      triggerElement.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 100, right: 200, bottom: 120, left: 180, width: 20, height: 20
      });
      document.body.appendChild(triggerElement);

      // Open submenu
      folderSubmenu.toggle(triggerElement, 'nested/path');
    });

    it('should close on Escape keydown when visible', () => {
      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(true);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(false);
    });

    it('should not close on Escape keydown if not visible', () => {
      // Setup spy on closeAll (indirectly by observing trigger element state)
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      // Close it first
      folderSubmenu.toggle(triggerElement, 'nested/path');
      expect(triggerElement.getAttribute('aria-expanded')).toBe('false');

      // Set to true manually to see if Escape changes it when not visible
      triggerElement.setAttribute('aria-expanded', 'true');

      document.dispatchEvent(event);

      // Should not have been changed because it wasn't visible
      expect(triggerElement.getAttribute('aria-expanded')).toBe('true');
    });

    it('should close when clicking outside', () => {
      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(true);

      document.body.click(); // Click outside

      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(false);
    });

    it('should handle "Create Prompt" click and open GitHub URL', () => {
      const createPromptItem = document.querySelector(`[data-action="${FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT}"]`);

      createPromptItem.click();

      // Expected timestamp for simulated date May 15, 2023 12:30 -> "230515-1230"
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);

      const expectedPath = encodeURIComponent(`nested/path/prompt-230515-1230.md`);
      const expectedUrl = `https://github.com/owner1/repo1/new/branch1?filename=${expectedPath}&ref=branch1`;

      expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');

      // Verify menu closed after action
      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(false);
    });

    it('should handle "Create Prompt" click without a path', () => {
      // Close and open without path
      folderSubmenu.toggle(triggerElement, 'nested/path');
      folderSubmenu.toggle(triggerElement, '');

      const createPromptItem = document.querySelector(`[data-action="${FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_PROMPT}"]`);
      createPromptItem.click();

      const expectedPath = encodeURIComponent(`prompt-230515-1230.md`);
      const expectedUrl = `https://github.com/owner1/repo1/new/branch1?filename=${expectedPath}&ref=branch1`;

      expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');
    });

    it('should handle "Create Conversation" click and open GitHub URL', () => {
      const createConversationItem = document.querySelector(`[data-action="${FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_CONVERSATION}"]`);

      createConversationItem.click();

      expect(mockWindowOpen).toHaveBeenCalledTimes(1);

      const expectedPath = encodeURIComponent(`nested/path/conversation.md`);
      const expectedValue = encodeURIComponent('Conversation Template Data');
      const expectedUrl = `https://github.com/owner1/repo1/new/branch1?filename=${expectedPath}&value=${expectedValue}&ref=branch1`;

      expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');

      // Verify menu closed after action
      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl.classList.contains('folder-submenu--visible')).toBe(false);
    });

    it('should handle "Create Conversation" click without a path', () => {
      // Close and open without path
      folderSubmenu.toggle(triggerElement, 'nested/path');
      folderSubmenu.toggle(triggerElement, '');

      const createConversationItem = document.querySelector(`[data-action="${FOLDER_SUBMENU_TEXT.ACTIONS.CREATE_CONVERSATION}"]`);
      createConversationItem.click();

      const expectedPath = encodeURIComponent(`conversation.md`);
      const expectedValue = encodeURIComponent('Conversation Template Data');
      const expectedUrl = `https://github.com/owner1/repo1/new/branch1?filename=${expectedPath}&value=${expectedValue}&ref=branch1`;

      expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer');
    });
  });

  describe('destroy', () => {
    it('should clean up DOM and listeners', () => {
      folderSubmenu.init();
      folderSubmenu.setContext('owner', 'repo', 'branch');

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const submenuEl = document.querySelector('.folder-submenu');
      expect(submenuEl).not.toBeNull();

      folderSubmenu.destroy();

      // Document click listener removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

      // Document keydown listener removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // DOM element removed
      expect(document.querySelector('.folder-submenu')).toBeNull();
    });

    it('should be safe to call destroy multiple times or before init', () => {
      expect(() => {
        folderSubmenu.destroy();
        folderSubmenu.destroy();
        folderSubmenu.init();
        folderSubmenu.destroy();
      }).not.toThrow();
    });
  });
});
