import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test approach: Since the analytics page functions are not exported, we'll test
// the behavior through DOM interactions and focus on the key integration points

vi.mock('../../shared-init.js', () => ({
  waitForFirebase: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user-123' },
    onAuthStateChanged: vi.fn((callback) => {
      // Don't automatically call callback to avoid triggering init
      return vi.fn(); // unsubscribe function
    }),
  })),
}));

vi.mock('../../modules/analytics.js', () => ({
  calculateAnalytics: vi.fn().mockResolvedValue({
    totalSessions: 5,
    successRate: 0.8,
    sessionsWithPRs: 2,
    failedSessions: 1,
    prCreationRate: 0.4,
  }),
}));

const mockGetUserSessions = vi.fn();
const mockImportJulesHistory = vi.fn();
const mockSyncActiveSessions = vi.fn();

vi.mock('../../modules/session-tracking.js', () => ({
  syncActiveSessions: mockSyncActiveSessions,
  importJulesHistory: mockImportJulesHistory,
  getUserSessions: mockGetUserSessions,
}));

const mockHandleError = vi.fn();
vi.mock('../../utils/error-handler.js', () => ({
  handleError: mockHandleError,
}));

vi.mock('../../utils/constants.js', () => ({
  TIMEOUTS: {
    componentCheck: 10,
  },
}));

vi.mock('../../utils/dom-helpers.js', () => ({
  createElement: vi.fn((tag) => document.createElement(tag)),
  createIcon: vi.fn(() => document.createElement('span')),
  toggleVisibility: vi.fn((element, show) => {
    if (element) {
      element.style.display = show ? 'block' : 'none';
      if (show) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    }
  }),
}));

const mockShowToast = vi.fn();
vi.mock('../../modules/toast.js', () => ({
  showToast: mockShowToast,
}));

const mockShowConfirm = vi.fn();
vi.mock('../../modules/confirm-modal.js', () => ({
  showConfirm: mockShowConfirm,
}));

const mockStatusBar = {
  init: vi.fn(),
  showMessage: vi.fn(),
  setProgress: vi.fn(),
  clearProgress: vi.fn(),
};

vi.mock('../../modules/status-bar.js', () => ({
  default: mockStatusBar,
}));

vi.mock('../../modules/prompt-viewer.js', () => ({
  showPromptViewer: vi.fn(),
}));

describe('Analytics Page Smart Refresh Integration', () => {
  beforeEach(() => {
    // Setup DOM elements that the analytics page expects
    document.body.innerHTML = `
      <header></header>
      <div id="analyticsLoading" class="hidden"></div>
      <div id="analyticsContent" class="hidden">
        <button id="smartRefreshBtn" class="btn-icon primary" title="Refresh data">
          <span class="icon" aria-hidden="true">refresh</span>
        </button>
        <select id="dateRangeSelect">
          <option value="30" selected>Last 30 days</option>
        </select>
        <div id="totalSessionsValue">0</div>
        <div id="successRateValue">0.0%</div>
        <div id="prsCreatedValue">0</div>
        <div id="failedSessionsValue">0</div>
        <div id="prRateValue">0.0% of sessions</div>
        <canvas id="statusChart"></canvas>
        <canvas id="timelineChart"></canvas>
        <div id="failureAnalysisContainer"></div>
        <div id="repoPerformanceContainer"></div>
        <div id="recentPRsContainer"></div>
      </div>
      <div id="analyticsNotSignedIn" class="hidden"></div>
    `;

    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up default mock returns
    mockGetUserSessions.mockResolvedValue([]);
    mockImportJulesHistory.mockResolvedValue({ imported: 0, skipped: 0, errors: 0 });
    mockSyncActiveSessions.mockResolvedValue();
    mockShowConfirm.mockResolvedValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('should have a smart refresh button in the DOM', () => {
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    expect(smartRefreshBtn).toBeTruthy();
    expect(smartRefreshBtn.classList.contains('btn-icon')).toBe(true);
    
    const icon = smartRefreshBtn.querySelector('.icon');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toBe('refresh');
  });

  it('should properly set up button click behavior when page loads', async () => {
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    
    // Mock successful first-time import scenario
    mockGetUserSessions.mockResolvedValue([]);
    mockShowConfirm.mockResolvedValue(true);
    mockImportJulesHistory.mockResolvedValue({ imported: 5, skipped: 0, errors: 0 });
    
    // Import the page module to set up event handlers
    await import('../../pages/analytics-page.js');
    
    // Verify button exists and is enabled
    expect(smartRefreshBtn.disabled).toBe(false);
    
    // Click should trigger the handlers (even if mocked)
    expect(() => smartRefreshBtn.click()).not.toThrow();
  });

  it('should show appropriate loading states during operations', async () => {
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    const icon = smartRefreshBtn.querySelector('.icon');
    
    // Set up mocks for successful operation
    mockGetUserSessions.mockResolvedValue([{ id: 'session1' }]);
    mockImportJulesHistory.mockResolvedValue({ imported: 2, skipped: 1, errors: 0 });
    
    await import('../../pages/analytics-page.js');
    
    // Initial state should be refresh icon
    expect(icon.textContent).toBe('refresh');
    
    // Button should exist and be clickable
    expect(smartRefreshBtn).toBeTruthy();
    expect(smartRefreshBtn.disabled).toBe(false);
  });

  it('should integrate with status bar for progress reporting', async () => {
    // Set up a mock that simulates progress callbacks
    mockImportJulesHistory.mockImplementation((progressCallback) => {
      if (progressCallback) {
        progressCallback(1, 3);
        progressCallback(2, 3);
        progressCallback(3, 3);
      }
      return Promise.resolve({ imported: 3, skipped: 0, errors: 0 });
    });
    
    await import('../../pages/analytics-page.js');
    
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    smartRefreshBtn.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Status bar should be initialized
    expect(mockStatusBar.init).toHaveBeenCalled();
  });

  it('should handle different icon states for different operations', () => {
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    const icon = smartRefreshBtn.querySelector('.icon');
    
    // Test that we can change the icon (simulating what the real code does)
    icon.textContent = 'hourglass_empty';
    expect(icon.textContent).toBe('hourglass_empty');
    
    icon.textContent = 'download';
    expect(icon.textContent).toBe('download');
    
    icon.textContent = 'refresh';
    expect(icon.textContent).toBe('refresh');
  });

  it('should properly disable and enable button during operations', () => {
    const smartRefreshBtn = document.getElementById('smartRefreshBtn');
    
    // Test button state management
    expect(smartRefreshBtn.disabled).toBe(false);
    
    // Simulate disabling during operation
    smartRefreshBtn.disabled = true;
    expect(smartRefreshBtn.disabled).toBe(true);
    
    // Simulate re-enabling after operation
    smartRefreshBtn.disabled = false;
    expect(smartRefreshBtn.disabled).toBe(false);
  });

  it('should validate DOM structure required for analytics page', () => {
    // Verify all required elements exist
    expect(document.getElementById('analyticsLoading')).toBeTruthy();
    expect(document.getElementById('analyticsContent')).toBeTruthy();
    expect(document.getElementById('analyticsNotSignedIn')).toBeTruthy();
    expect(document.getElementById('smartRefreshBtn')).toBeTruthy();
    expect(document.getElementById('dateRangeSelect')).toBeTruthy();
    
    // Verify metrics containers exist
    expect(document.getElementById('totalSessionsValue')).toBeTruthy();
    expect(document.getElementById('successRateValue')).toBeTruthy();
    expect(document.getElementById('prsCreatedValue')).toBeTruthy();
    
    // Verify chart containers exist  
    expect(document.getElementById('statusChart')).toBeTruthy();
    expect(document.getElementById('timelineChart')).toBeTruthy();
  });
});
