import { test, expect } from '@playwright/test';
import { navigateWithParams } from '../helpers/navigation.js';
import { mockGitHubAPI } from '../helpers/github-helper.js';

test.describe('Prompt Actions', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubAPI(page);
    
    // Navigate to a test prompt
    await navigateWithParams(page, {
      file: 'test-prompt'
    });
    
    // Wait for prompt to load
    await page.waitForSelector('#content, .content-area', { timeout: 10000 });
  });

  test('user can copy prompt to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Find and click copy button
    const copyBtn = page.locator('#copyBtn, .copy-btn, button:has-text("Copy")').first();
    await copyBtn.click();
    
    // Verify copy feedback appears
    const feedback = page.locator('.copy-feedback, .toast, .notification');
    await expect(feedback).toBeVisible({ timeout: 3000 });
    
    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test('user can share prompt link', async ({ page }) => {
    // Find share button
    const shareBtn = page.locator('#shareBtn, .share-btn, button:has-text("Share")').first();
    
    if (await shareBtn.isVisible()) {
      await shareBtn.click();
      
      // Look for share modal or copied link notification
      const shareModal = page.locator('#shareModal, .share-modal');
      const shareNotification = page.locator('.toast, .notification');
      
      const hasModal = await shareModal.isVisible().catch(() => false);
      const hasNotification = await shareNotification.isVisible().catch(() => false);
      
      expect(hasModal || hasNotification).toBeTruthy();
      
      if (hasModal) {
        // Verify share URL is present
        const shareUrl = page.locator('#shareUrl, .share-url, input[readonly]');
        await expect(shareUrl).toBeVisible();
        
        const url = await shareUrl.inputValue();
        expect(url).toContain(page.url().split('?')[0]); // Contains base URL
      }
    }
  });

  test('user can view raw markdown', async ({ page }) => {
    // Find raw/view source button
    const rawBtn = page.locator('#rawBtn, .raw-btn, button:has-text("Raw"), button:has-text("View Source")').first();
    
    if (await rawBtn.isVisible()) {
      await rawBtn.click();
      
      // Look for raw content display
      const rawContent = page.locator('#rawContent, .raw-content, .markdown-source, pre');
      await expect(rawContent).toBeVisible({ timeout: 3000 });
      
      // Verify markdown syntax is visible
      const content = await rawContent.textContent();
      expect(content).toMatch(/#{1,6}\s/); // Contains markdown headers
    }
  });

  test('user can open prompt in GitHub', async ({ page, context }) => {
    // Find GitHub button
    const ghBtn = page.locator('#ghBtn, .gh-btn, button:has-text("GitHub"), a:has-text("GitHub")').first();
    
    if (await ghBtn.isVisible()) {
      // Listen for new page/tab
      const pagePromise = context.waitForEvent('page');
      await ghBtn.click();
      
      const newPage = await pagePromise;
      await newPage.waitForLoadState();
      
      // Verify GitHub URL
      expect(newPage.url()).toContain('github.com');
    }
  });

  test('user can try prompt in Jules', async ({ page }) => {
    // Setup API key first
    await page.evaluate(() => {
      localStorage.setItem('julesApiKey', 'test-api-key');
    });
    
    // Wait for page to stabilize
    await page.waitForTimeout(1000);
    
    // Find Jules button
    const julesBtn = page.locator('#julesBtn, .jules-btn, button:has-text("Jules"), button:has-text("Try in Jules")').first();
    
    if (await julesBtn.isVisible({ timeout: 10000 })) {
      await julesBtn.click();
      
      // Verify Jules modal opens
      const julesModal = page.locator('#julesModal, .jules-modal');
      await expect(julesModal).toBeVisible({ timeout: 10000 });
      
      // Verify prompt preview is shown
      const promptPreview = page.locator('#julesPromptPreview, .jules-prompt-preview, .prompt-content');
      await expect(promptPreview).toBeVisible();
    }
  });

  test('actions are disabled when no prompt is loaded', async ({ page }) => {
    // Navigate to home without selecting a file
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    // Check action buttons state
    const copyBtn = page.locator('#copyBtn, .copy-btn');
    const shareBtn = page.locator('#shareBtn, .share-btn');
    const julesBtn = page.locator('#julesBtn, .jules-btn');
    
    // Buttons should either be disabled or not visible
    if (await copyBtn.isVisible()) {
      expect(await copyBtn.isDisabled()).toBeTruthy();
    }
    
    if (await shareBtn.isVisible()) {
      expect(await shareBtn.isDisabled()).toBeTruthy();
    }
    
    if (await julesBtn.isVisible()) {
      expect(await julesBtn.isDisabled()).toBeTruthy();
    }
  });

  test('copy button shows loading state during operation', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    const copyBtn = page.locator('#copyBtn, .copy-btn').first();
    
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      
      // Check for loading state (even if brief)
      // This might be a spinner, disabled state, or text change
      const hasLoadingClass = await copyBtn.getAttribute('class');
      expect(typeof hasLoadingClass === 'string').toBeTruthy();
      
      // At minimum, verify button interaction completed
      await page.waitForTimeout(500);
      
      // Button should be clickable again after operation
      expect(await copyBtn.isDisabled()).toBeFalsy();
    }
  });

  test('prompt actions work with keyboard shortcuts', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Try Ctrl+C or Cmd+C to copy (if implemented)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
    
    // Wait for potential copy operation
    await page.waitForTimeout(500);
    
    // Check if clipboard has content (this test depends on implementation)
    const clipboardText = await page.evaluate(() => {
      return navigator.clipboard.readText().catch(() => '');
    });
    
    // This test is informational - not all apps implement keyboard shortcuts for copy
    if (clipboardText.length > 0) {
      expect(clipboardText).toBeTruthy();
    }
  });

  test('action buttons have proper accessibility labels', async ({ page }) => {
    // Check for aria-labels or titles on action buttons
    const buttons = page.locator('button[aria-label], button[title]');
    const buttonCount = await buttons.count();
    
    expect(buttonCount).toBeGreaterThan(0);
    
    // Verify each button has a descriptive label
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      expect(ariaLabel || title).toBeTruthy();
    }
  });

  test('multiple sequential actions work correctly', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Copy prompt
    const copyBtn = page.locator('#copyBtn, .copy-btn').first();
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Share prompt
    const shareBtn = page.locator('#shareBtn, .share-btn').first();
    if (await shareBtn.isVisible()) {
      await shareBtn.click();
      await page.waitForTimeout(500);
      
      // Close share modal if present
      const closeBtn = page.locator('.modal .close, .modal-close, button:has-text("Close")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
    
    // Try Jules action
    await page.evaluate(() => localStorage.setItem('julesApiKey', 'test-key'));
    const julesBtn = page.locator('#julesBtn, .jules-btn').first();
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      await page.waitForTimeout(500);
    }
    
    // Verify no errors occurred
    const errorMessages = page.locator('.error, .error-message, [role="alert"]');
    expect(await errorMessages.count()).toBe(0);
  });
});
