import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDropdown } from '../../modules/dropdown.js';

describe('dropdown', () => {
  let mockBtn, mockMenu, mockContainer;
  let dropdown;
  let items = [];

  // Helper to make elements visible to getItems() checks
  function makeVisible(element) {
    Object.defineProperty(element, 'offsetParent', {
      get() { return document.body; },
      configurable: true
    });
  }

  function createMenuItem(role = 'menuitem', text = 'Item') {
    const item = document.createElement('div');
    item.setAttribute('role', role);
    item.setAttribute('tabindex', '-1');
    item.textContent = text;
    makeVisible(item);
    return item;
  }

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock dropdown structure
    mockContainer = document.createElement('div');
    mockContainer.className = 'dropdown-container';
    
    mockBtn = document.createElement('button');
    mockBtn.className = 'dropdown-btn';
    mockBtn.setAttribute('aria-expanded', 'false');
    mockContainer.appendChild(mockBtn);
    
    mockMenu = document.createElement('div');
    mockMenu.className = 'dropdown-menu';
    makeVisible(mockMenu);
    mockContainer.appendChild(mockMenu);
    
    document.body.appendChild(mockContainer);
    
    // Reset openDropdowns set by triggering closeAll logic
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // Clear items array
    items = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initDropdown', () => {
    it('should initialize dropdown with button and menu', () => {
      dropdown = initDropdown(mockBtn, mockMenu);
      expect(dropdown).toHaveProperty('open');
      expect(dropdown).toHaveProperty('close');
      expect(dropdown).toHaveProperty('toggle');
    });

    it('should set initial attributes', () => {
      initDropdown(mockBtn, mockMenu);
      expect(mockBtn.getAttribute('aria-haspopup')).toBe('true');
      expect(mockBtn.getAttribute('aria-expanded')).toBe('false');
      expect(mockMenu.getAttribute('role')).toBe('menu');
    });

    it('should not overwrite existing role on menu', () => {
      mockMenu.setAttribute('role', 'listbox');
      initDropdown(mockBtn, mockMenu);
      expect(mockMenu.getAttribute('role')).toBe('listbox');
    });
  });

  describe('focus management', () => {
    beforeEach(() => {
      // Add items
      for (let i = 0; i < 3; i++) {
        const item = createMenuItem('menuitem', `Item ${i}`);
        mockMenu.appendChild(item);
        items.push(item);
      }
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    it('should focus first item when opened', async () => {
      const focusSpy = vi.spyOn(items[0], 'focus');
      dropdown.open();

      // Wait for requestAnimationFrame
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      expect(focusSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(items[0]);
    });

    it('should focus search input if present', async () => {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      makeVisible(searchInput);
      mockMenu.insertBefore(searchInput, items[0]);
      
      const focusSpy = vi.spyOn(searchInput, 'focus');
      dropdown.open();
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      expect(focusSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        const item = createMenuItem('menuitem', `Item ${i}`);
        mockMenu.appendChild(item);
        items.push(item);
      }
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
      dropdown.open();
    });

    it('should navigate down with ArrowDown', () => {
      items[0].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement).toBe(items[1]);
    });

    it('should navigate up with ArrowUp', () => {
      items[1].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(document.activeElement).toBe(items[0]);
    });

    it('should wrap around when navigating down from last item', () => {
      items[2].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement).toBe(items[0]);
    });

    it('should wrap around when navigating up from first item', () => {
      items[0].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(document.activeElement).toBe(items[2]);
    });

    it('should go to first item with Home', () => {
      items[2].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      expect(document.activeElement).toBe(items[0]);
    });

    it('should go to last item with End', () => {
      items[0].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      expect(document.activeElement).toBe(items[2]);
    });

    it('should click item with Enter', () => {
      items[0].focus();
      const clickSpy = vi.spyOn(items[0], 'click');
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should click item with Space', () => {
      items[0].focus();
      const clickSpy = vi.spyOn(items[0], 'click');
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should close dropdown on Tab', () => {
      items[0].focus();
      mockMenu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(mockMenu.classList.contains('open')).toBe(false);
    });

    it('should close dropdown on Escape and return focus to button', () => {
      items[0].focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(false);
      expect(document.activeElement).toBe(mockBtn);
    });
  });

  describe('button keyboard interaction', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        const item = createMenuItem('menuitem', `Item ${i}`);
        mockMenu.appendChild(item);
        items.push(item);
      }
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
    });

    it('should open dropdown with ArrowDown on button', async () => {
      mockBtn.focus();
      mockBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      expect(document.activeElement).toBe(items[0]);
    });

    it('should open dropdown with ArrowUp on button', async () => {
      mockBtn.focus();
      mockBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      
      expect(mockMenu.classList.contains('open')).toBe(true);
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      expect(document.activeElement).toBe(items[0]);
    });
  });

  describe('search input interaction', () => {
    let searchInput;

    beforeEach(() => {
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      makeVisible(searchInput);
      mockMenu.appendChild(searchInput);
      
      for (let i = 0; i < 3; i++) {
        const item = createMenuItem('menuitem', `Item ${i}`);
        mockMenu.appendChild(item);
        items.push(item);
      }
      
      dropdown = initDropdown(mockBtn, mockMenu, mockContainer);
      dropdown.open();
    });

    it('should move focus to first item when ArrowDown pressed in search', () => {
      searchInput.focus();
      // Need to dispatch directly to input as target
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      Object.defineProperty(event, 'target', { value: searchInput });
      mockMenu.dispatchEvent(event);
      
      expect(document.activeElement).toBe(items[0]);
    });

    it('should not prevent default behavior for other keys in search', () => {
      searchInput.focus();
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      Object.defineProperty(event, 'target', { value: searchInput });
      
      mockMenu.dispatchEvent(event);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });
});
