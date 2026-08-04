import { test, expect } from '@playwright/test';
import { navigateWithParams } from '../helpers/navigation.js';
import { mockGitHubAPI } from '../helpers/github-helper.js';

test.describe('Run in Agent Split Button', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubAPI(page);

    // Navigate to a test prompt
    await navigateWithParams(page, {
      file: 'test-prompt'
    });

    // Wait for prompt to load
    await page.waitForSelector('#content, .content-area', { timeout: 10000 });
  });

  test('legacy julesBtn and braceBtn no longer exist', async ({ page }) => {
    const julesBtn = page.locator('#julesBtn');
    const braceBtn = page.locator('#braceBtn');

    await expect(julesBtn).toHaveCount(0);
    await expect(braceBtn).toHaveCount(0);
  });

  test('#runInAgentContainer split button is present', async ({ page }) => {
    const container = page.locator('#runInAgentContainer');
    await expect(container).toBeVisible({ timeout: 5000 });
  });

  test('split button has action and toggle buttons', async ({ page }) => {
    const container = page.locator('#runInAgentContainer');
    await expect(container).toBeVisible({ timeout: 5000 });

    const actionBtn = container.locator('.split-btn__action');
    const toggleBtn = container.locator('.split-btn__toggle');

    await expect(actionBtn).toBeVisible();
    await expect(toggleBtn).toBeVisible();
  });

  test('split button dropdown shows Jules, OpenHands, and Brace options', async ({ page }) => {
    const container = page.locator('#runInAgentContainer');
    await expect(container).toBeVisible({ timeout: 5000 });

    // Click the toggle to open dropdown
    const toggleBtn = container.locator('.split-btn__toggle');
    await toggleBtn.click();

    // Wait for menu to appear
    const menu = container.locator('.split-btn__menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Check for Jules option
    const julesOption = menu.locator('[data-value="jules"]');
    await expect(julesOption).toBeVisible();

    // Check for OpenHands option
    const openhandsOption = menu.locator('[data-value="openhands"]');
    await expect(openhandsOption).toBeVisible();

    // Check for Brace option
    const braceOption = menu.locator('[data-value="brace"]');
    await expect(braceOption).toBeVisible();
  });

  test('Brace option is disabled when not configured', async ({ page }) => {
    // Brace requires auth (OpenClaw config) to be enabled. Without being logged in,
    // the brace menu item should have aria-disabled="true".
    const container = page.locator('#runInAgentContainer');
    await expect(container).toBeVisible({ timeout: 5000 });

    const toggleBtn = container.locator('.split-btn__toggle');
    await toggleBtn.click();

    const menu = container.locator('.split-btn__menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    const braceOption = menu.locator('[data-value="brace"]');
    await expect(braceOption).toHaveAttribute('aria-disabled', 'true');
  });

  test('localStorage persists agent selection across reload', async ({ page }) => {
    // Set agent preference in localStorage
    await page.evaluate(() => {
      localStorage.setItem('agenticQueue.lastAgent', 'jules');
    });

    // Reload page
    await page.reload();
    await page.waitForSelector('#runInAgentContainer', { timeout: 10000 });

    // Verify localStorage value persists
    const stored = await page.evaluate(() => {
      return localStorage.getItem('agenticQueue.lastAgent');
    });

    expect(stored).toBe('jules');
  });

  test('freeInputRunInAgentContainer is present in free input section', async ({ page }) => {
    // This test requires a logged-in user to render the free input section.
    // Skip rather than assert a trivially-true condition (count >= 0 is meaningless).
    // TODO: wire up a test user fixture to assert count === 1 and split button renders.
    test.skip(true, 'Requires authenticated test user to render freeInputSection; skipping to avoid no-op assertion');
  });
});
