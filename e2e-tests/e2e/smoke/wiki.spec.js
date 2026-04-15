import { test, expect } from '@playwright/test';

async function mockExternalResources(page) {
  await page.route('**/firebasejs/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.firebase = {
          initializeApp: () => ({}),
          auth: () => ({
            onAuthStateChanged: (cb) => { setTimeout(() => cb(null), 0); return () => {}; }
          }),
          firestore: () => ({})
        };
      `
    });
  });
  await page.route('**/fonts.gstatic.com/**', route => {
    route.fulfill({ status: 200, body: '' });
  });
}

const FIXTURE_INDEX = {
  version: 1,
  generatedAt: '2026-04-14T00:00:00.000Z',
  docs: [
    {
      slug: 'dev-history-wiki',
      title: 'Development History Wiki',
      date: '2026-04-13',
      status: 'in-progress',
      owner: 'jesse',
      tags: ['infra', 'rag'],
      visibility: 'public',
      related: [],
      docPath: 'wiki/dev-history-wiki.md',
      private: false,
      headings: [{ level: 2, text: 'Objective' }],
      lastModified: '2026-04-13T00:00:00.000Z'
    },
    {
      slug: 'private-secret',
      title: 'Private Secret',
      date: '2026-04-01',
      status: 'approved',
      owner: 'jesse',
      tags: [],
      visibility: 'private',
      related: [],
      docPath: 'wiki/private/secret.md',
      private: true,
      headings: [],
      lastModified: '2026-04-01T00:00:00.000Z'
    }
  ]
};

test.describe('Wiki smoke', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalResources(page);
    await page.route('**/wiki/_index.json', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FIXTURE_INDEX)
      });
    });
  });

  test('renders the wiki page and sidebar tree', async ({ page }) => {
    await page.goto('/wiki');
    await page.waitForSelector('#wikiTree .wiki-tree-link', { timeout: 20000 });
    const titles = await page.locator('#wikiTree .wiki-tree-link').allTextContents();
    expect(titles.join(' ')).toContain('Development History Wiki');
  });

  test('excludes private docs for unauthenticated users', async ({ page }) => {
    await page.goto('/wiki');
    await page.waitForSelector('#wikiTree .wiki-tree-link', { timeout: 20000 });
    const titles = await page.locator('#wikiTree .wiki-tree-link').allTextContents();
    expect(titles.join(' ')).not.toContain('Private Secret');
  });

  test('header has a Wiki navigation link', async ({ page }) => {
    await page.goto('/wiki');
    await page.waitForSelector('header', { timeout: 20000 });
    const wikiLink = page.locator('a[href="/wiki"], a[href$="/wiki"]').first();
    await expect(wikiLink).toBeVisible({ timeout: 5000 });
  });
});
