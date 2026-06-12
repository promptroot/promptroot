import { test, expect } from '@playwright/test';

const FIXTURE_SDDS = [
  {
    slug: 'dev-history-wiki',
    title: 'Development History Wiki',
    date: '2026-04-13',
    status: 'in-progress',
    owner: 'jesse',
    tags: ['infra', 'rag'],
    visibility: 'public',
    related: [],
    currentVersion: 'v1'
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
    currentVersion: 'v1'
  }
];

// authUser: null = unauthenticated session (canSeePrivate=false), object = signed-in (canSeePrivate=true)
async function mockResources(page, { authUser = null } = {}) {
  // Firebase SDK — provide a currentUser so getIdToken() works for the listSdds API
  // call, but control canSeePrivate separately via onAuthStateChanged.
  const fakeApiUser = `{ uid: 'test-user', getIdToken: async () => 'fake-token' }`;
  const authStateUser = authUser ? `{ uid: 'test-user' }` : 'null';
  await page.route('**/firebasejs/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.firebase = {
          initializeApp: () => ({}),
          auth: () => ({
            currentUser: ${fakeApiUser},
            onAuthStateChanged: (cb) => { setTimeout(() => cb(${authStateUser}), 0); return () => {}; }
          }),
          firestore: () => ({})
        };
      `
    });
  });

  await page.route('**/fonts.gstatic.com/**', route => {
    route.fulfill({ status: 200, body: '' });
  });

  // Mock the listSdds Cloud Function
  await page.route('**/listSdds**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tenantId: 'promptroot', sdds: FIXTURE_SDDS })
    });
  });
}

test.describe('Wiki smoke', () => {
  test('renders the wiki page and sidebar tree', async ({ page }) => {
    await mockResources(page, { authUser: { uid: 'test-user' } });
    await page.goto('/pages/wiki/wiki.html?tenant=promptroot');
    await page.waitForSelector('#wikiTree .wiki-tree-link', { timeout: 20000 });
    const titles = await page.locator('#wikiTree .wiki-tree-link').allTextContents();
    expect(titles.join(' ')).toContain('Development History Wiki');
  });

  test('excludes private docs for unauthenticated users', async ({ page }) => {
    // currentUser is set so the API call works, but onAuthStateChanged fires with
    // null → canSeePrivate stays false → private docs are filtered from the tree.
    await mockResources(page, { authUser: null });
    await page.goto('/pages/wiki/wiki.html?tenant=promptroot');
    await page.waitForSelector('#wikiTree .wiki-tree-link', { timeout: 20000 });
    const titles = await page.locator('#wikiTree .wiki-tree-link').allTextContents();
    expect(titles.join(' ')).not.toContain('Private Secret');
  });
});
