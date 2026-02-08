/**
 * GitHub API test helpers
 */

/**
 * Mock GitHub API responses for testing
 * @param {import('@playwright/test').Page} page
 */
export async function mockGitHubAPI(page) {
  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    
    // Mock repository contents endpoint
    if (url.includes('/repos/') && url.includes('/contents/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'test-prompt.md',
            path: 'prompts/test-prompt.md',
            type: 'file',
            download_url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test-prompt.md'
          },
          {
            name: 'examples',
            path: 'prompts/examples',
            type: 'dir'
          }
        ])
      });
    }
    // Mock file content endpoint
    else if (url.includes('raw.githubusercontent.com')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: '# Test Prompt\n\nThis is mock content for testing.'
      });
    }
    // Mock user endpoint
    else if (url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          login: 'testuser',
          id: 12345,
          name: 'Test User',
          email: 'test@example.com'
        })
      });
    }
    // Default: continue with original request
    else {
      await route.continue();
    }
  });
}

/**
 * Set GitHub authentication token for testing
 * @param {import('@playwright/test').Page} page
 * @param {string} token - GitHub token
 */
export async function setGitHubToken(page, token) {
  await page.evaluate((t) => {
    localStorage.setItem('githubToken', t);
  }, token);
}

/**
 * Clear GitHub authentication
 * @param {import('@playwright/test').Page} page
 */
export async function clearGitHubAuth(page) {
  await page.evaluate(() => {
    localStorage.removeItem('githubToken');
    localStorage.removeItem('githubUser');
  });
}

/**
 * Mock GitHub OAuth flow
 * @param {import('@playwright/test').Page} page
 */
export async function mockGitHubOAuth(page) {
  // Intercept OAuth redirect
  await page.route('https://github.com/login/oauth/**', async (route) => {
    await route.fulfill({
      status: 302,
      headers: {
        'Location': `${page.url()}?code=test-oauth-code`
      }
    });
  });
  
  // Mock token exchange
  await page.route('**/oauth/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-access-token',
        token_type: 'bearer',
        scope: 'repo,user'
      })
    });
  });
}

/**
 * Wait for GitHub API rate limit reset (mocked for tests)
 * @param {import('@playwright/test').Page} page
 */
export async function waitForRateLimitReset(page) {
  // In real tests, this would check rate limit headers
  // For now, just wait a short time
  await page.waitForTimeout(100);
}

/**
 * Get mock repository tree structure
 */
export function getMockRepoTree() {
  return [
    { path: 'prompts', type: 'tree', name: 'prompts' },
    { path: 'prompts/test-prompt.md', type: 'blob', name: 'test-prompt.md' },
    { path: 'prompts/examples', type: 'tree', name: 'examples' },
    { path: 'prompts/examples/example-1.md', type: 'blob', name: 'example-1.md' },
    { path: 'prompts/examples/example-2.md', type: 'blob', name: 'example-2.md' },
    { path: 'prompts/tutorial', type: 'tree', name: 'tutorial' },
    { path: 'prompts/tutorial/getting-started.md', type: 'blob', name: 'getting-started.md' }
  ];
}
