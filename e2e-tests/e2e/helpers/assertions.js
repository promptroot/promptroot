/**
 * Custom assertions for E2E tests
 */
import { expect } from '@playwright/test';

/**
 * Assert that a prompt has loaded successfully
 * @param {import('@playwright/test').Page} page
 * @param {string} title - Expected prompt title
 */
export async function expectPromptLoaded(page, title) {
  await expect(page.locator('#title')).toContainText(title);
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('#actions')).toBeVisible();
}

/**
 * Assert that authentication was successful
 * @param {import('@playwright/test').Page} page
 */
export async function expectAuthenticationSuccess(page) {
  await expect(page.locator('#userProfile')).toBeVisible();
  await expect(page.locator('#loginBtn')).not.toBeVisible();
}

/**
 * Assert that user is not authenticated
 * @param {import('@playwright/test').Page} page
 */
export async function expectUnauthenticated(page) {
  await expect(page.locator('#loginBtn')).toBeVisible();
  await expect(page.locator('#userProfile')).not.toBeVisible();
}

/**
 * Assert that file tree has loaded successfully
 * @param {import('@playwright/test').Page} page
 */
export async function expectFileTreeLoaded(page) {
  await expect(page.locator('#file-tree')).toBeVisible();
  const fileCount = await page.locator('.file-item').count();
  expect(fileCount).toBeGreaterThan(0);
}

/**
 * Assert that a specific file exists in the tree
 * @param {import('@playwright/test').Page} page
 * @param {string} fileName - Name of the file
 */
export async function expectFileInTree(page, fileName) {
  await expect(page.locator(`.file-item:has-text("${fileName}")`)).toBeVisible();
}

/**
 * Assert that a folder is expanded
 * @param {import('@playwright/test').Page} page
 * @param {string} folderPath - Folder path
 */
export async function expectFolderExpanded(page, folderPath) {
  const folder = page.locator(`.folder[data-path="${folderPath}"]`);
  const isExpanded = await folder.getAttribute('data-expanded');
  expect(isExpanded).toBe('true');
}

/**
 * Assert that a folder is collapsed
 * @param {import('@playwright/test').Page} page
 * @param {string} folderPath - Folder path
 */
export async function expectFolderCollapsed(page, folderPath) {
  const folder = page.locator(`.folder[data-path="${folderPath}"]`);
  const isExpanded = await folder.getAttribute('data-expanded');
  expect(isExpanded).toBe('false');
}

/**
 * Assert that Jules modal is open
 * @param {import('@playwright/test').Page} page
 */
export async function expectJulesModalOpen(page) {
  await expect(page.locator('#julesModal')).toBeVisible();
  await expect(page.locator('#julesPromptPreview')).toBeVisible();
}

/**
 * Assert that a toast/notification is displayed
 * @param {import('@playwright/test').Page} page
 * @param {string} message - Expected message text
 */
export async function expectToastVisible(page, message) {
  await expect(page.locator('.toast')).toBeVisible();
  if (message) {
    await expect(page.locator('.toast')).toContainText(message);
  }
}

/**
 * Assert that an error message is displayed
 * @param {import('@playwright/test').Page} page
 * @param {string} errorText - Expected error text
 */
export async function expectErrorMessage(page, errorText) {
  const errorLocator = page.locator('.error-message, .error, [role="alert"]');
  await expect(errorLocator).toBeVisible();
  if (errorText) {
    await expect(errorLocator).toContainText(errorText);
  }
}

/**
 * Assert that URL contains specific parameters
 * @param {import('@playwright/test').Page} page
 * @param {object} params - Expected URL parameters
 */
export async function expectUrlParams(page, params) {
  const url = new URL(page.url());
  for (const [key, value] of Object.entries(params)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

/**
 * Assert that clipboard contains expected text
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedText - Expected clipboard content
 */
export async function expectClipboardContains(page, expectedText) {
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain(expectedText);
}

/**
 * Assert that element is focused
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - Element selector
 */
export async function expectFocused(page, selector) {
  const focusedElement = await page.evaluate(() => document.activeElement);
  const element = await page.$(selector);
  expect(focusedElement).toEqual(element);
}

/**
 * Assert that queue has items
 * @param {import('@playwright/test').Page} page
 * @param {number} expectedCount - Expected number of items (optional)
 */
export async function expectQueueItems(page, expectedCount = null) {
  const items = page.locator('.queue-item');
  await expect(items.first()).toBeVisible();
  
  if (expectedCount !== null) {
    await expect(items).toHaveCount(expectedCount);
  }
}

/**
 * Assert that page has no accessibility violations
 * @param {import('@playwright/test').Page} page
 * @param {import('@axe-core/playwright').AxeBuilder} AxeBuilder
 */
export async function expectNoA11yViolations(page, AxeBuilder) {
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
}

/**
 * Assert that localStorage contains specific key/value
 * @param {import('@playwright/test').Page} page
 * @param {string} key - Storage key
 * @param {string} expectedValue - Expected value (optional)
 */
export async function expectLocalStorageItem(page, key, expectedValue = null) {
  const value = await page.evaluate((k) => localStorage.getItem(k), key);
  expect(value).not.toBeNull();
  
  if (expectedValue !== null) {
    expect(value).toBe(expectedValue);
  }
}

/**
 * Assert that session storage contains specific key/value
 * @param {import('@playwright/test').Page} page
 * @param {string} key - Storage key
 * @param {string} expectedValue - Expected value (optional)
 */
export async function expectSessionStorageItem(page, key, expectedValue = null) {
  const value = await page.evaluate((k) => sessionStorage.getItem(k), key);
  expect(value).not.toBeNull();
  
  if (expectedValue !== null) {
    expect(value).toBe(expectedValue);
  }
}
