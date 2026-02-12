import { test, expect } from '@playwright/test';
import { mockGitHubAPI } from '../helpers/github-helper.js';

/**
 * Free Input Functionality Tests
 */

// Mock external CDN resources to prevent test failures due to network issues
async function mockExternalResources(page) {
  // Mock Firebase SDK with functional stubs
  await page.route('**/firebasejs/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        // Firebase mock with functional auth and firestore
        window.firebase = {
          initializeApp: () => ({}),
          auth: () => ({
            onAuthStateChanged: (callback) => {
              // Call callback with a mock user immediately
              const user = {
                uid: 'test-user-123',
                getIdToken: () => Promise.resolve('mock-token'),
                displayName: 'Test User'
              };
              setTimeout(() => callback(user), 0);
              // Return unsubscribe function
              return () => {};
            },
            currentUser: {
              uid: 'test-user-123',
              getIdToken: () => Promise.resolve('mock-token'),
              displayName: 'Test User'
            }
          }),
          firestore: () => ({
            collection: (name) => ({
              doc: (id) => ({
                get: () => Promise.resolve({
                  exists: name === 'julesKeys', // Simulate key exists
                  data: () => ({ key: 'encrypted-key', iv: 'iv', salt: 'salt' }),
                  id: id
                }),
                set: () => Promise.resolve(),
                update: () => Promise.resolve(),
                delete: () => Promise.resolve()
              }),
              add: () => Promise.resolve({ id: 'new-doc-id' }),
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    get: () => Promise.resolve({ docs: [] })
                  })
                }),
                get: () => Promise.resolve({ docs: [] })
              })
            })
          })
        };
      `
    });
  });

  // Mock Google Fonts
  await page.route('**/fonts.gstatic.com/**', route => {
    route.fulfill({ status: 200, body: '' });
  });
}

test.describe('Free Input Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubAPI(page);
    await mockExternalResources(page);
    await page.goto('/');
  });

  test('opens free input form when button is clicked', async ({ page }) => {
    // Wait for the button to be available (in sidebar)
    const freeInputBtn = page.locator('#freeInputBtn');
    await expect(freeInputBtn).toBeVisible();

    // Click the button
    await freeInputBtn.click();

    // Expect the free input section to be visible
    const freeInputSection = page.locator('#freeInputSection');
    await expect(freeInputSection).toBeVisible({ timeout: 5000 });

    // Expect textarea to be visible
    const textarea = page.locator('#freeInputTextarea');
    await expect(textarea).toBeVisible();

    // Type something
    await textarea.fill('Test prompt');
    await expect(textarea).toHaveValue('Test prompt');

    // Check repository selector is present (as user is logged in)
    const repoSelector = page.locator('#freeInputRepoDropdownBtn');
    await expect(repoSelector).toBeVisible();
  });
});
