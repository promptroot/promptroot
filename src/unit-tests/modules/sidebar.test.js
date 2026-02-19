import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSidebar } from '../../modules/sidebar.js';

// Mock localStorage for jsdom environment
const localStorageMock = (() => {
  let store = {};
  
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    }
  };
})();

describe('sidebar', () => {
  let mockSidebar;
  let mockToggleBtn;
  let getItemSpy;
  let setItemSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Create mock elements
    mockSidebar = document.createElement('div');
    mockSidebar.id = 'sidebar';
    
    mockToggleBtn = document.createElement('button');
    mockToggleBtn.id = 'sidebarToggle';
    
    document.body.appendChild(mockSidebar);
    document.body.appendChild(mockToggleBtn);
    
    // Set up localStorage mock
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true
    });

    // Create spies on the mock
    getItemSpy = vi.spyOn(localStorage, 'getItem');
    setItemSpy = vi.spyOn(localStorage, 'setItem');
    
    // Create console.error spy
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initSidebar', () => {
    it('should initialize sidebar without collapsed state', () => {
      // No previous state in localStorage
      getItemSpy.mockReturnValue(null);
      
      initSidebar();
      
      expect(getItemSpy).toHaveBeenCalledWith('sidebar-collapsed');
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should restore collapsed state from localStorage', () => {
      getItemSpy.mockReturnValue('true');
      
      initSidebar();
      
      expect(getItemSpy).toHaveBeenCalledWith('sidebar-collapsed');
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
    });

    it('should not collapse sidebar when localStorage value is "false"', () => {
      getItemSpy.mockReturnValue('false');
      
      initSidebar();
      
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should handle non-boolean localStorage values gracefully', () => {
      getItemSpy.mockReturnValue('some-string');
      
      initSidebar();
      
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
    });

    it('should toggle sidebar and save state on button click', () => {
      getItemSpy.mockReturnValue(null);
      
      initSidebar();
      
      // Initially not collapsed
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
      
      // Click to collapse
      mockToggleBtn.click();
      
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
      expect(setItemSpy).toHaveBeenCalledWith('sidebar-collapsed', true);
    });

    it('should toggle sidebar from collapsed to expanded', () => {
      // Start with collapsed sidebar
      getItemSpy.mockReturnValue('true');
      
      initSidebar();
      
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
      
      // Click to expand
      mockToggleBtn.click();
      
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith('sidebar-collapsed', false);
    });

    it('should handle multiple toggle clicks', () => {
      getItemSpy.mockReturnValue(null);
      
      initSidebar();
      
      // Click 1: collapse
      mockToggleBtn.click();
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
      expect(setItemSpy).toHaveBeenNthCalledWith(1, 'sidebar-collapsed', true);
      
      // Click 2: expand
      mockToggleBtn.click();
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
      expect(setItemSpy).toHaveBeenNthCalledWith(2, 'sidebar-collapsed', false);
      
      // Click 3: collapse again
      mockToggleBtn.click();
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
      expect(setItemSpy).toHaveBeenNthCalledWith(3, 'sidebar-collapsed', true);
    });

    it('should do nothing when sidebar element is missing', () => {
      document.body.removeChild(mockSidebar);
      
      initSidebar();
      
      // Should not throw error and not access localStorage
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should do nothing when toggle button is missing', () => {
      document.body.removeChild(mockToggleBtn);
      
      initSidebar();
      
      // Should not throw error and not access localStorage
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should do nothing when both elements are missing', () => {
      document.body.removeChild(mockSidebar);
      document.body.removeChild(mockToggleBtn);
      
      initSidebar();
      
      // Should not throw error and not access localStorage
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.getItem to throw error
      getItemSpy.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      // Should not throw error - sidebar.js wraps in try/catch
      expect(() => {
        initSidebar();
      }).not.toThrow();
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      getItemSpy.mockReturnValue(null);
      
      initSidebar();
      
      // Mock localStorage.setItem to throw error after init (storage full)
      setItemSpy.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // The click should not throw error
      expect(() => {
        mockToggleBtn.click();
      }).not.toThrow();
      
      // Sidebar should still toggle visually
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
    });

    it('should work with pre-existing collapsed class', () => {
      // Add collapsed class before init
      mockSidebar.classList.add('collapsed');
      getItemSpy.mockReturnValue('false');
      
      initSidebar();
      
      // Should maintain existing class since initSidebar only adds, doesn't remove
      expect(mockSidebar.classList.contains('collapsed')).toBe(true);
      
      // Click should toggle correctly
      mockToggleBtn.click();
      expect(mockSidebar.classList.contains('collapsed')).toBe(false);
      expect(setItemSpy).toHaveBeenCalledWith('sidebar-collapsed', false);
    });

    it('should use exact storage key "sidebar-collapsed"', () => {
      getItemSpy.mockReturnValue(null);
      
      initSidebar();
      
      expect(getItemSpy).toHaveBeenCalledWith('sidebar-collapsed');
      
      mockToggleBtn.click();
      
      expect(setItemSpy).toHaveBeenCalledWith('sidebar-collapsed', true);
    });
  });
});