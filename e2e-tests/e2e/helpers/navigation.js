/**
 * Common navigation patterns for E2E tests
 */

/**
 * Navigate to a specific prompt by its file path
 * @param {import('@playwright/test').Page} page
 * @param {string} promptPath - File path of the prompt (e.g., 'prompts/test-prompt.md')
 */
export async function navigateToPrompt(page, promptPath) {
  await page.goto('/');
  await page.waitForSelector('#file-tree', { timeout: 10000 });
  
  // Click the file in the tree
  const fileSelector = `[data-file-path="${promptPath}"]`;
  await page.click(fileSelector);
  
  // Wait for content to load
  await page.waitForSelector('#content', { timeout: 5000 });
}

/**
 * Authenticate a user via GitHub OAuth flow
 * @param {import('@playwright/test').Page} page
 * @param {object} user - User credentials
 */
export async function authenticateUser(page, user) {
  await page.goto('/');
  
  // Click GitHub login button
  await page.click('#githubLoginBtn');
  
  // Wait for auth to complete (in test environment, this might be mocked)
  await page.waitForSelector('#userProfile', { timeout: 10000 });
}

/**
 * Select a specific repository and branch
 * @param {import('@playwright/test').Page} page
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 */
export async function selectRepo(page, owner, repo, branch) {
  await page.goto('/');
  
  // Open repo selector
  await page.click('#repoSelector');
  
  // Fill in repo details
  await page.fill('#ownerInput', owner);
  await page.fill('#repoInput', repo);
  await page.fill('#branchInput', branch);
  
  // Submit
  await page.click('#loadRepoBtn');
  
  // Wait for file tree to load
  await page.waitForSelector('#file-tree', { timeout: 10000 });
}

/**
 * Navigate using URL parameters (deep linking)
 * @param {import('@playwright/test').Page} page
 * @param {object} params - URL parameters
 */
export async function navigateWithParams(page, params) {
  const searchParams = new URLSearchParams(params);
  await page.goto(`/?${searchParams.toString()}`);
}

/**
 * Wait for navigation to complete
 * @param {import('@playwright/test').Page} page
 */
export async function waitForNavigation(page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Open the Jules modal for a loaded prompt
 * @param {import('@playwright/test').Page} page
 */
export async function openJulesModal(page) {
  await page.click('#julesBtn');
  await page.waitForSelector('#julesModal', { timeout: 5000 });
}

/**
 * Navigate to a specific page
 * @param {import('@playwright/test').Page} page
 * @param {string} pageName - Page name ('queue', 'profile', 'sessions', etc.)
 */
export async function navigateToPage(page, pageName) {
  const pageUrls = {
    queue: '/pages/queue/queue.html',
    profile: '/pages/profile/profile.html',
    sessions: '/pages/sessions/sessions.html',
    jules: '/pages/jules/jules.html',
    webcapture: '/pages/webcapture/webcapture.html'
  };
  
  await page.goto(pageUrls[pageName] || '/');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Expand a folder in the file tree
 * @param {import('@playwright/test').Page} page
 * @param {string} folderPath - Folder path
 */
export async function expandFolder(page, folderPath) {
  const folderSelector = `.folder[data-path="${folderPath}"]`;
  const folder = page.locator(folderSelector);
  
  // Check if already expanded
  const isExpanded = await folder.getAttribute('data-expanded') === 'true';
  
  if (!isExpanded) {
    await folder.click();
    await page.waitForTimeout(300); // Allow animation to complete
  }
}

/**
 * Collapse a folder in the file tree
 * @param {import('@playwright/test').Page} page
 * @param {string} folderPath - Folder path
 */
export async function collapseFolder(page, folderPath) {
  const folderSelector = `.folder[data-path="${folderPath}"]`;
  const folder = page.locator(folderSelector);
  
  // Check if already collapsed
  const isExpanded = await folder.getAttribute('data-expanded') === 'true';
  
  if (isExpanded) {
    await folder.click();
    await page.waitForTimeout(300); // Allow animation to complete
  }
}
