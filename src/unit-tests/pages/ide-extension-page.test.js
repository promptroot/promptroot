import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIMEOUTS, VSCODE_EXTENSION_URL } from '../../utils/constants.js';

describe('IDE Extension Page', () => {
  let installBtn;

  beforeEach(() => {
    document.body.innerHTML = `
      <header></header>
      <button id="installExtensionBtn">
        <span class="icon icon-inline" aria-hidden="true">store</span> Install from VS Code Marketplace
      </button>
    `;
    installBtn = document.getElementById('installExtensionBtn');
    vi.useFakeTimers();
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('should initialize and handle click on install button', async () => {
    // Import the module to trigger initialization
    await import('../../pages/ide-extension-page.js');

    const originalHTML = installBtn.innerHTML;

    // Simulate click
    installBtn.click();

    // Should be disabled
    expect(installBtn.disabled).toBe(true);

    // Should show "Opening Marketplace..."
    expect(installBtn.textContent).toContain('Opening Marketplace...');
    expect(installBtn.querySelector('.icon').textContent).toBe('hourglass_top');

    // window.open should have been called
    expect(window.open).toHaveBeenCalledWith(VSCODE_EXTENSION_URL, '_blank', 'noopener');

    // Should show "Marketplace opened"
    expect(installBtn.textContent).toContain('Marketplace opened');
    expect(installBtn.querySelector('.icon').textContent).toBe('check_circle');

    // Fast-forward time
    vi.advanceTimersByTime(TIMEOUTS.actionFeedback);

    // Should be re-enabled and restored
    expect(installBtn.disabled).toBe(false);
    expect(installBtn.innerHTML).toBe(originalHTML);
  });
});
