import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import statusBar from '../../modules/status-bar.js';
import { TIMEOUTS } from '../../utils/constants.js';

describe('status-bar', () => {
  let mockStatusBarElement, mockMsgElement, mockProgressElement, mockActionElement, mockCloseElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Create mock status bar structure
    mockStatusBarElement = document.createElement('div');
    mockStatusBarElement.id = 'statusBar';
    mockStatusBarElement.className = 'status-bar';
    
    mockMsgElement = document.createElement('div');
    mockMsgElement.className = 'status-msg';
    mockStatusBarElement.appendChild(mockMsgElement);
    
    mockProgressElement = document.createElement('div');
    mockProgressElement.className = 'status-progress hidden';
    mockStatusBarElement.appendChild(mockProgressElement);
    
    mockActionElement = document.createElement('button');
    mockActionElement.className = 'status-action hidden';
    mockStatusBarElement.appendChild(mockActionElement);
    
    mockCloseElement = document.createElement('button');
    mockCloseElement.className = 'status-close';
    mockStatusBarElement.appendChild(mockCloseElement);
    
    document.body.appendChild(mockStatusBarElement);
    
    // Reset the status bar state
    statusBar.element = null;
    statusBar.msgElement = null;
    statusBar.progressElement = null;
    statusBar.actionElement = null;
    statusBar.closeElement = null;
    statusBar.currentTimeout = null;
    
    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    
    // Clear any timeouts
    if (statusBar.currentTimeout) {
      clearTimeout(statusBar.currentTimeout);
      statusBar.currentTimeout = null;
    }
  });

  describe('init', () => {
    it('should initialize status bar elements when status bar exists', () => {
      statusBar.init();
      
      expect(statusBar.element).toBe(mockStatusBarElement);
      expect(statusBar.msgElement).toBe(mockMsgElement);
      expect(statusBar.progressElement).toBe(mockProgressElement);
      expect(statusBar.actionElement).toBe(mockActionElement);
      expect(statusBar.closeElement).toBe(mockCloseElement);
    });

    it('should hide status bar initially', () => {
      mockStatusBarElement.classList.add('status-visible');
      
      statusBar.init();
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
    });

    it('should add click handler to close button', () => {
      statusBar.init();
      
      // Add visible status to test close functionality
      mockStatusBarElement.classList.add('status-visible');
      
      mockCloseElement.click();
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
      expect(mockStatusBarElement.classList.contains('hidden')).toBe(true);
    });

    it('should do nothing when status bar element does not exist', () => {
      document.body.removeChild(mockStatusBarElement);
      
      statusBar.init();
      
      expect(statusBar.element).toBe(null);
      expect(statusBar.msgElement).toBe(null);
      expect(statusBar.progressElement).toBe(null);
      expect(statusBar.actionElement).toBe(null);
    });

    it('should handle missing close button gracefully', () => {
      mockStatusBarElement.removeChild(mockCloseElement);
      
      expect(() => {
        statusBar.init();
      }).not.toThrow();
      
      expect(statusBar.closeElement).toBe(null);
    });
  });

  describe('showMessage', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should display message with default timeout', () => {
      const message = 'Loading data...';
      
      statusBar.showMessage(message);
      
      expect(mockMsgElement.textContent).toBe(message);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      expect(mockStatusBarElement.classList.contains('hidden')).toBe(false);
    });

    it('should auto-hide message after default timeout', () => {
      statusBar.showMessage('Test message');
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Fast forward time
      vi.advanceTimersByTime(TIMEOUTS.statusBar);
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
      expect(mockStatusBarElement.classList.contains('hidden')).toBe(true);
    });

    it('should use custom timeout when provided', () => {
      const customTimeout = 5000;
      
      statusBar.showMessage('Custom timeout message', { timeout: customTimeout });
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Fast forward less than custom timeout
      vi.advanceTimersByTime(customTimeout - 1000);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Fast forward to reach custom timeout
      vi.advanceTimersByTime(1000);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
    });

    it('should not auto-hide when timeout is 0', () => {
      statusBar.showMessage('Persistent message', { timeout: 0 });
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Fast forward well beyond default timeout
      vi.advanceTimersByTime(TIMEOUTS.statusBar * 2);
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
    });

    it('should clear existing timeout when showing new message', () => {
      statusBar.showMessage('First message');
      
      // Partially advance time
      vi.advanceTimersByTime(TIMEOUTS.statusBar / 2);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Show new message, should reset timeout
      statusBar.showMessage('Second message');
      expect(mockMsgElement.textContent).toBe('Second message');
      
      // Advance time to where first message would have expired
      vi.advanceTimersByTime(TIMEOUTS.statusBar / 2);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Advance remaining time for new timeout
      vi.advanceTimersByTime(TIMEOUTS.statusBar / 2);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
    });

    it('should do nothing when element or msgElement is missing', () => {
      statusBar.element = null;
      statusBar.msgElement = null;
      
      expect(() => {
        statusBar.showMessage('Test message');
      }).not.toThrow();
    });
  });

  describe('setProgress', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should display progress text and show progress element', () => {
      const progressText = 'Uploading... 50%';
      
      statusBar.setProgress(progressText, 50);
      
      expect(mockProgressElement.textContent).toBe(progressText);
      expect(mockProgressElement.classList.contains('hidden')).toBe(false);
    });

    it('should do nothing when progressElement is missing', () => {
      statusBar.progressElement = null;
      
      expect(() => {
        statusBar.setProgress('Test progress', 25);
      }).not.toThrow();
    });
  });

  describe('clearProgress', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should clear progress text and hide progress element', () => {
      // Set some progress first
      mockProgressElement.textContent = 'Some progress';
      mockProgressElement.classList.remove('hidden');
      
      statusBar.clearProgress();
      
      expect(mockProgressElement.textContent).toBe('');
      expect(mockProgressElement.classList.contains('hidden')).toBe(true);
    });

    it('should do nothing when progressElement is missing', () => {
      statusBar.progressElement = null;
      
      expect(() => {
        statusBar.clearProgress();
      }).not.toThrow();
    });
  });

  describe('setAction', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should set action button label and callback', () => {
      const actionLabel = 'Cancel';
      const mockCallback = vi.fn();
      
      statusBar.setAction(actionLabel, mockCallback);
      
      expect(mockActionElement.textContent).toBe(actionLabel);
      expect(mockActionElement.classList.contains('hidden')).toBe(false);
      
      // Test callback is set
      mockActionElement.click();
      expect(mockCallback).toHaveBeenCalledOnce();
    });

    it('should do nothing when actionElement is missing', () => {
      statusBar.actionElement = null;
      
      expect(() => {
        statusBar.setAction('Test action', vi.fn());
      }).not.toThrow();
    });
  });

  describe('clearAction', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should clear action button and hide element', () => {
      // Set action first
      mockActionElement.textContent = 'Cancel';
      mockActionElement.classList.remove('hidden');
      mockActionElement.onclick = vi.fn();
      
      statusBar.clearAction();
      
      expect(mockActionElement.textContent).toBe('');
      expect(mockActionElement.classList.contains('hidden')).toBe(true);
      expect(mockActionElement.onclick).toBe(null);
    });

    it('should do nothing when actionElement is missing', () => {
      statusBar.actionElement = null;
      
      expect(() => {
        statusBar.clearAction();
      }).not.toThrow();
    });
  });

  describe('hide', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should hide status bar and clear timeout', () => {
      // Show status bar first
      statusBar.showMessage('Test message');
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      expect(statusBar.currentTimeout).not.toBe(null);
      
      statusBar.hide();
      
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
      expect(mockStatusBarElement.classList.contains('hidden')).toBe(true);
      expect(statusBar.currentTimeout).toBe(null);
    });

    it('should do nothing when element is missing', () => {
      statusBar.element = null;
      
      expect(() => {
        statusBar.hide();
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should clear all status bar content and hide', () => {
      // Set up status bar with content
      statusBar.showMessage('Test message');
      statusBar.setProgress('Progress text', 75);
      statusBar.setAction('Cancel', vi.fn());
      
      // Verify content is set
      expect(mockMsgElement.textContent).toBe('Test message');
      expect(mockProgressElement.textContent).toBe('Progress text');
      expect(mockActionElement.textContent).toBe('Cancel');
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      statusBar.clear();
      
      // Verify everything is cleared
      expect(mockProgressElement.textContent).toBe('');
      expect(mockProgressElement.classList.contains('hidden')).toBe(true);
      expect(mockActionElement.textContent).toBe('');
      expect(mockActionElement.classList.contains('hidden')).toBe(true);
      expect(mockActionElement.onclick).toBe(null);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
      expect(mockStatusBarElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      statusBar.init();
    });

    it('should handle complete workflow: show message, add progress, add action, then clear', () => {
      // Step 1: Show message
      statusBar.showMessage('Processing request...');
      expect(mockMsgElement.textContent).toBe('Processing request...');
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(true);
      
      // Step 2: Add progress
      statusBar.setProgress('Uploading files... 25%', 25);
      expect(mockProgressElement.textContent).toBe('Uploading files... 25%');
      expect(mockProgressElement.classList.contains('hidden')).toBe(false);
      
      // Step 3: Add action
      const cancelCallback = vi.fn();
      statusBar.setAction('Cancel', cancelCallback);
      expect(mockActionElement.textContent).toBe('Cancel');
      expect(mockActionElement.classList.contains('hidden')).toBe(false);
      
      // Test action works
      mockActionElement.click();
      expect(cancelCallback).toHaveBeenCalledOnce();
      
      // Step 4: Clear everything
      statusBar.clear();
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
      expect(mockProgressElement.classList.contains('hidden')).toBe(true);
      expect(mockActionElement.classList.contains('hidden')).toBe(true);
    });

    it('should handle rapid message updates without timeout conflicts', () => {
      // Show first message
      statusBar.showMessage('Message 1');
      expect(mockMsgElement.textContent).toBe('Message 1');
      
      // Quickly show second message
      vi.advanceTimersByTime(500);
      statusBar.showMessage('Message 2');
      expect(mockMsgElement.textContent).toBe('Message 2');
      
      // Quickly show third message
      vi.advanceTimersByTime(500);
      statusBar.showMessage('Message 3');
      expect(mockMsgElement.textContent).toBe('Message 3');
      
      // Only the last message should auto-hide
      vi.advanceTimersByTime(TIMEOUTS.statusBar);
      expect(mockStatusBarElement.classList.contains('status-visible')).toBe(false);
    });
  });
});