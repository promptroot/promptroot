import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadHeader } from '../../modules/header.js';

// Mock the dropdown module
vi.mock('../../modules/dropdown.js', () => ({
  initDropdown: vi.fn()
}));

describe('header', () => {
  let fetchSpy;
  let mockResponseText;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Mock fetch
    mockResponseText = `
      <header>
        <button id="userMenuButton">User Menu</button>
        <div id="userMenuDropdown">User Dropdown</div>
        <button id="mobileMenuBtn">Mobile Menu</button>
        <div id="mobileSidebar">
          <button id="mobileSidebarClose">Close</button>
          <a href="/test">Test Link</a>
          <button>Test Button</button>
        </div>
        <div id="mobileOverlay"></div>
        <div class="mobile-nav-item" data-page="test">Test Page</div>
        <button id="footerFeedbackBtn">Feedback</button>
      </header>
    `;
    
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockResponseText)
    });
    global.fetch = fetchSpy;
    
    // Mock window methods
    global.open = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/' }
    });
    
    // Clear any existing overflow styles
    document.body.style.overflow = '';
    
    // Mock queueMicrotask to execute immediately in tests
    vi.stubGlobal('queueMicrotask', (callback) => callback());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  describe('loadHeader', () => {
    it('should not load header if header already exists', async () => {
      document.body.innerHTML = '<header>Existing Header</header>';
      
      await loadHeader();
      
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should fetch header from BASE path when in promptroot', async () => {
      window.location.pathname = '/promptroot/page';
      
      await loadHeader();
      
      expect(fetchSpy).toHaveBeenCalledWith('/promptroot/partials/header.html');
    });

    it('should fetch header from root path for normal pages', async () => {
      window.location.pathname = '/normal-page';
      
      await loadHeader();
      
      expect(fetchSpy).toHaveBeenCalledWith('/partials/header.html');
    });

    it('should fallback to root path if BASE path fails', async () => {
      window.location.pathname = '/promptroot/page';
      fetchSpy
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ 
          ok: true, 
          text: () => Promise.resolve(mockResponseText) 
        });
      
      await loadHeader();
      
      expect(fetchSpy).toHaveBeenNthCalledWith(1, '/promptroot/partials/header.html');
      expect(fetchSpy).toHaveBeenNthCalledWith(2, '/partials/header.html');
    });

    it('should fix href and src paths when BASE is set', async () => {
      window.location.pathname = '/promptroot/page';
      const htmlWithPaths = '<header><a href="/test">Test</a><img src="/image.jpg"></header>';
      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlWithPaths)
      });
      
      await loadHeader();
      
      const header = document.querySelector('header');
      expect(header.innerHTML).toContain('href="/promptroot/test"');
      expect(header.innerHTML).toContain('src="/promptroot/image.jpg"');
    });

    it('should not fix paths when BASE is empty', async () => {
      window.location.pathname = '/normal-page';
      const htmlWithPaths = '<header><a href="/test">Test</a><img src="/image.jpg"></header>';
      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlWithPaths)
      });
      
      await loadHeader();
      
      const header = document.querySelector('header');
      expect(header.innerHTML).toContain('href="/test"');
      expect(header.innerHTML).toContain('src="/image.jpg"');
    });

    it('should insert header at beginning of body', async () => {
      document.body.innerHTML = '<div>Existing Content</div>';
      
      await loadHeader();
      
      expect(document.body.firstElementChild.tagName).toBe('HEADER');
    });

    it('should handle fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchSpy.mockRejectedValue(new Error('Network error'));
      
      await loadHeader();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load header:', expect.any(Error));
    });
  });

  describe('user menu setup', () => {
    let initDropdownSpy;

    beforeEach(async () => {
      const { initDropdown } = await import('../../modules/dropdown.js');
      initDropdownSpy = initDropdown;
      await loadHeader();
    });

    it('should initialize user menu dropdown', () => {
      const userMenuButton = document.getElementById('userMenuButton');
      const userMenuDropdown = document.getElementById('userMenuDropdown');
      
      expect(initDropdownSpy).toHaveBeenCalledWith(userMenuButton, userMenuDropdown);
    });
  });

  describe('mobile sidebar setup', () => {
    let mobileMenuBtn, mobileSidebar, mobileSidebarClose, mobileOverlay;

    beforeEach(async () => {
      await loadHeader();
      mobileMenuBtn = document.getElementById('mobileMenuBtn');
      mobileSidebar = document.getElementById('mobileSidebar');
      mobileSidebarClose = document.getElementById('mobileSidebarClose');
      mobileOverlay = document.getElementById('mobileOverlay');
    });

    it('should open mobile sidebar when menu button is clicked', () => {
      mobileMenuBtn.click();
      
      expect(mobileSidebar.classList.contains('open')).toBe(true);
      expect(mobileOverlay.classList.contains('show')).toBe(true);
      expect(document.body.classList.contains('mobile-menu-open')).toBe(true);
    });

    it('should close mobile sidebar when close button is clicked', () => {
      // Open first
      mobileMenuBtn.click();
      expect(mobileSidebar.classList.contains('open')).toBe(true);
      
      mobileSidebarClose.click();
      
      expect(mobileSidebar.classList.contains('open')).toBe(false);
      expect(mobileOverlay.classList.contains('show')).toBe(false);
      expect(document.body.classList.contains('mobile-menu-open')).toBe(false);
    });

    it('should close mobile sidebar when overlay is clicked', () => {
      mobileMenuBtn.click();
      expect(mobileSidebar.classList.contains('open')).toBe(true);
      
      mobileOverlay.click();
      
      expect(mobileSidebar.classList.contains('open')).toBe(false);
      expect(mobileOverlay.classList.contains('show')).toBe(false);
    });

    it('should focus close button when sidebar opens', () => {
      const focusSpy = vi.spyOn(mobileSidebarClose, 'focus');
      
      mobileMenuBtn.click();
      
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should focus menu button when sidebar closes', () => {
      const focusSpy = vi.spyOn(mobileMenuBtn, 'focus');
      
      mobileMenuBtn.click();
      mobileSidebarClose.click();
      
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle missing mobile sidebar elements gracefully', async () => {
      // Clear existing header and load one without mobile elements
      document.body.innerHTML = '';
      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<header><div>No mobile elements</div></header>')
      });
      
      expect(() => loadHeader()).not.toThrow();
    });
  });

  describe('focus trapping', () => {
    let mobileMenuBtn, mobileSidebar, mobileSidebarClose;
    let testLink, testButton;

    beforeEach(async () => {
      await loadHeader();
      mobileMenuBtn = document.getElementById('mobileMenuBtn');
      mobileSidebar = document.getElementById('mobileSidebar');
      mobileSidebarClose = document.getElementById('mobileSidebarClose');
      testLink = mobileSidebar.querySelector('a[href="/test"]');
      testButton = mobileSidebar.querySelector('button:not(#mobileSidebarClose)');
    });

    it('should trap focus within mobile sidebar when Tab is pressed', () => {
      mobileMenuBtn.click(); // Open sidebar
      
      // Focus on last element, then Tab forward
      testButton.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(tabEvent, 'preventDefault');
      
      document.dispatchEvent(tabEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should trap focus backwards when Shift+Tab is pressed', () => {
      mobileMenuBtn.click(); // Open sidebar
      
      // Focus on first element, then Shift+Tab backward
      mobileSidebarClose.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', { 
        key: 'Tab', 
        shiftKey: true, 
        bubbles: true 
      });
      const preventDefaultSpy = vi.spyOn(shiftTabEvent, 'preventDefault');
      
      document.dispatchEvent(shiftTabEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not trap focus when sidebar is closed', () => {
      // Sidebar closed by default
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(tabEvent, 'preventDefault');
      
      document.dispatchEvent(tabEvent);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should not trap focus for non-Tab keys', () => {
      mobileMenuBtn.click(); // Open sidebar
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
      
      document.dispatchEvent(enterEvent);
      
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('mobile navigation active state', () => {
    it('should set active class for current page', async () => {
      document.body.setAttribute('data-page', 'test');
      
      await loadHeader();
      
      const mobileNavItem = document.querySelector('.mobile-nav-item[data-page="test"]');
      expect(mobileNavItem.classList.contains('active')).toBe(true);
    });

    it('should not set active class when no current page', async () => {
      document.body.removeAttribute('data-page'); // Ensure no data-page attribute
      
      await loadHeader();
      
      const mobileNavItem = document.querySelector('.mobile-nav-item[data-page="test"]');
      expect(mobileNavItem.classList.contains('active')).toBe(false);
    });

    it('should not set active class when page does not match', async () => {
      document.body.setAttribute('data-page', 'other');
      
      await loadHeader();
      
      const mobileNavItem = document.querySelector('.mobile-nav-item[data-page="test"]');
      expect(mobileNavItem.classList.contains('active')).toBe(false);
    });
  });

  describe('feedback button setup', () => {
    beforeEach(async () => {
      await loadHeader();
    });

    it('should open GitHub issue page when feedback button is clicked', () => {
      const feedbackBtn = document.getElementById('footerFeedbackBtn');
      
      feedbackBtn.click();
      
      expect(global.open).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/github\.com\/promptroot\/promptroot\/issues\/new/),
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should include feedback template in GitHub issue', () => {
      const feedbackBtn = document.getElementById('footerFeedbackBtn');
      
      feedbackBtn.click();
      
      const [url] = global.open.mock.calls[0];
      expect(url).toContain('title=%5BFeedback%20%23');
      expect(url).toContain('%23%23%20Issue');
      expect(url).toContain('%23%23%20Screenshot');
      expect(url).toContain('%23%23%20Steps%20to%20Recreate');
      expect(url).toContain('labels=feedback');
    });

    it('should handle missing feedback button gracefully', async () => {
      document.body.innerHTML = '';
      fetchSpy.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<header><div>No feedback button</div></header>')
      });
      
      expect(() => loadHeader()).not.toThrow();
    });
  });

  describe('beforeunload handling', () => {
    it('should close mobile sidebar on window beforeunload', async () => {
      await loadHeader();
      
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      const mobileSidebar = document.getElementById('mobileSidebar');
      
      // Open sidebar
      mobileMenuBtn.click();
      expect(mobileSidebar.classList.contains('open')).toBe(true);
      
      // Trigger beforeunload
      window.dispatchEvent(new Event('beforeunload'));
      
      expect(mobileSidebar.classList.contains('open')).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete mobile sidebar workflow', async () => {
      await loadHeader();
      
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      const mobileSidebar = document.getElementById('mobileSidebar');
      const mobileOverlay = document.getElementById('mobileOverlay');
      
      // Initial state
      expect(mobileSidebar.classList.contains('open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
      
      // Open sidebar
      mobileMenuBtn.click();
      expect(mobileSidebar.classList.contains('open')).toBe(true);
      expect(mobileOverlay.classList.contains('show')).toBe(true);
      expect(document.body.classList.contains('mobile-menu-open')).toBe(true);
      
      // Close via overlay
      mobileOverlay.click();
      expect(mobileSidebar.classList.contains('open')).toBe(false);
      expect(mobileOverlay.classList.contains('show')).toBe(false);
      expect(document.body.classList.contains('mobile-menu-open')).toBe(false);
    });

    it('should initialize all components when header loads successfully', async () => {
      const { initDropdown } = await import('../../modules/dropdown.js');
      
      await loadHeader();
      
      // User menu should be initialized
      expect(initDropdown).toHaveBeenCalled();
      
      // Mobile functionality should work
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      mobileMenuBtn.click();
      expect(document.getElementById('mobileSidebar').classList.contains('open')).toBe(true);
      
      // Feedback button should work
      const feedbackBtn = document.getElementById('footerFeedbackBtn');
      feedbackBtn.click();
      expect(global.open).toHaveBeenCalled();
    });
  });
});