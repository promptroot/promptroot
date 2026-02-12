
import { test, expect } from '@playwright/test';

test.describe('Analytics Page Verification', () => {
  test('should load analytics page without errors and render key components', async ({ page }) => {
    // Mock Chart.js to prevent errors in headless mode and ensure charts "render"
    await page.addInitScript(() => {
      window.Chart = class {
        constructor(ctx, config) {
          this.ctx = ctx;
          this.config = config;
        }
        destroy() {}
        update() {}
      };
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore firebase errors that might occur due to lack of config/network in test
        if (!msg.text().includes('Firebase')) {
          consoleErrors.push(msg.text());
        }
      }
    });

    // Navigate to analytics page
    await page.goto('/pages/analytics/analytics.html');

    // Wait for initial JS to execute
    await page.waitForLoadState('domcontentloaded');

    // Since we are not signed in, we expect the "Not Signed In" message
    // This confirms that shared-init.js and analytics-page.js loaded and executed
    const notSignedIn = page.locator('#analyticsNotSignedIn');

    // We might need to wait for Firebase to initialize and auth state to resolve
    // Use a reasonable timeout
    await expect(notSignedIn).toBeVisible({ timeout: 10000 }).catch(e => {
       console.log('Not signed in panel not visible, checking content panel...');
    });

    // If we were somehow signed in (e.g. reused state), content would be visible
    const content = page.locator('#analyticsContent');
    const isContentVisible = await content.isVisible();
    const isNotSignedInVisible = await notSignedIn.isVisible();

    // One of them must be visible
    expect(isContentVisible || isNotSignedInVisible).toBeTruthy();

    // Verify no critical console errors
    expect(consoleErrors).toEqual([]);
  });
});
