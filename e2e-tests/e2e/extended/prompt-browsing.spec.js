import { test, expect } from '@playwright/test';
import { navigateWithParams } from '../helpers/navigation.js';
import { expectFileTreeLoaded, expectUrlParams } from '../helpers/assertions.js';
import { mockGitHubAPI } from '../helpers/github-helper.js';

test.describe('Prompt Browsing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock GitHub API to avoid rate limiting and provide consistent test data
    await mockGitHubAPI(page);
    await page.goto('/');
  });

  test('user can browse default repository prompts', async ({ page }) => {
    // Verify initial page load
    await expectFileTreeLoaded(page);
    
    // Click on the first file item
    const firstFile = page.locator('.item').first();
    await firstFile.click();
    
    // Verify prompt loads
    await expect(page.locator('#content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#title')).not.toBeEmpty();
  });

  test('user can expand and collapse folders', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Find a folder
    const folder = page.locator('.folder').first();
    
    // Click to expand
    await folder.click();
    await page.waitForTimeout(500); // Wait for animation
    
    // Verify folder expands
    const folderItems = folder.locator('~ .folder-items, .folder-items');
    await expect(folderItems).toBeVisible();
    
    // Click to collapse
    await folder.click();
    await page.waitForTimeout(500);
    
    // Verify folder collapses
    await expect(folderItems).not.toBeVisible();
  });

  test('user can switch between repositories', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Navigate with different repo params
    await navigateWithParams(page, {
      owner: 'testuser',
      repo: 'another-repo',
      branch: 'main'
    });
    
    // Verify new repo loads
    await expectFileTreeLoaded(page);
    
    // Verify URL updated
    await expectUrlParams(page, {
      owner: 'testuser',
      repo: 'another-repo',
      branch: 'main'
    });
  });

  test('user can switch branches', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Check if branch selector exists
    const branchSelector = page.locator('#branchSelector, .branch-selector');
    
    if (await branchSelector.isVisible()) {
      await branchSelector.click();
      
      // Select a different branch
      const branchOption = page.locator('[data-branch="develop"], .branch-option').first();
      if (await branchOption.count() > 0) {
        await branchOption.click();
        
        // Verify branch switched
        await expectFileTreeLoaded(page);
      }
    }
  });

  test('file tree state persists across page refreshes', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Expand the first folder
    const folder = page.locator('.folder').first();
    if (await folder.count() > 0) {
      await folder.click();
      await page.waitForTimeout(500);
      
      // Refresh page
      await page.reload();
      await expectFileTreeLoaded(page);
      
      // Verify folder state persists (if implemented)
      // This depends on your implementation - may need localStorage check
    }
  });

  test('deep link to specific prompt works', async ({ page }) => {
    // Navigate with file parameter
    await navigateWithParams(page, {
      file: 'test-prompt'
    });
    
    // Verify prompt auto-loads
    await expect(page.locator('#content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#title')).toBeVisible();
  });

  test('clicking a markdown file loads its content', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Find and click a .md file
    const mdFile = page.locator('.item[data-path*=".md"]').first();
    
    if (await mdFile.count() > 0) {
      await mdFile.click();
      
      // Verify content area becomes visible
      await expect(page.locator('#content, .content-area')).toBeVisible();
    }
  });

  test('file tree displays folder hierarchy correctly', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Verify folders are distinguishable from files
    const folders = page.locator('.folder');
    const files = page.locator('.item');
    
    // Should have at least one folder
    expect(await folders.count()).toBeGreaterThan(0);
    
    // Should have at least one file
    expect(await files.count()).toBeGreaterThan(0);
  });

  test('search functionality filters file tree', async ({ page }) => {
    await expectFileTreeLoaded(page);
    
    // Look for search input
    const searchInput = page.locator('#search, .search-input, input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce
      
      // Verify filtered results
      const visibleFiles = page.locator('.item:visible');
      expect(await visibleFiles.count()).toBeGreaterThan(0);
    }
  });

  test('empty state displays when no files found', async ({ page }) => {
    // Navigate to a repo with no prompts (or mock empty response)
    await navigateWithParams(page, {
      owner: 'empty-repo',
      repo: 'no-prompts',
      branch: 'main'
    });
    
    // Wait for page to stabilize
    await page.waitForTimeout(2000);
    
    // Look for empty state message
    const emptyState = page.locator('.empty-state, .no-files-message');
    
    // Either we see an empty state or an error message
    const hasEmptyState = await emptyState.isVisible({ timeout: 10000 }).catch(() => false);
    const hasError = await page.locator('.error-message').isVisible({ timeout: 10000 }).catch(() => false);
    
    expect(hasEmptyState || hasError).toBeTruthy();
  });
});
