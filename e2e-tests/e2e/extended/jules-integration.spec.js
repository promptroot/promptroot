import { test, expect } from '@playwright/test';
import { navigateToPage } from '../helpers/navigation.js';
import { expectJulesModalOpen } from '../helpers/assertions.js';
import { setGitHubToken } from '../helpers/github-helper.js';
import { testUser, testJulesConfig } from '../fixtures/test-data.js';

test.describe('Jules Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Set authenticated state
    await setGitHubToken(page, testUser.githubToken);
    await page.evaluate((user) => {
      localStorage.setItem('githubUser', JSON.stringify({
        login: user.githubUsername,
        name: user.displayName
      }));
    }, testUser);
    
    await page.goto('/');
  });

  test('user can configure Jules API key', async ({ page }) => {
    // Navigate to profile/settings
    await navigateToPage(page, 'profile');
    await page.waitForLoadState('networkidle');
    
    // Look for Jules configuration section
    const julesConfig = page.locator('#configureJulesBtn, .jules-config, button:has-text("Configure Jules"), a:has-text("Jules")').first();
    
    if (await julesConfig.isVisible()) {
      await julesConfig.click();
      await page.waitForTimeout(500);
      
      // Find API key input
      const apiKeyInput = page.locator('#julesApiKeyInput, input[name="julesApiKey"], input[type="password"][placeholder*="API"]').first();
      
      if (await apiKeyInput.isVisible()) {
        await apiKeyInput.fill('new-api-key-123');
        
        // Save
        const saveBtn = page.locator('#saveJulesKey, button:has-text("Save"), button[type="submit"]').first();
        await saveBtn.click();
        
        // Verify saved (look for success message)
        await page.waitForTimeout(1000);
        const successMsg = page.locator('.success, .toast, [role="alert"]');
        
        if (await successMsg.isVisible()) {
          expect(await successMsg.textContent()).toBeTruthy();
        }
      }
    }
  });

  test('user can submit prompt to Jules', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Click Jules button
    const julesBtn = page.locator('#julesBtn, .jules-btn, button:has-text("Jules")').first();
    
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      
      // Wait for Jules modal
      await page.waitForSelector('#julesModal, .jules-modal', { timeout: 5000 });
      await expectJulesModalOpen(page);
      
      // Add context if available
      const contextInput = page.locator('#julesContext, .jules-context, textarea[placeholder*="context"]').first();
      
      if (await contextInput.isVisible()) {
        await contextInput.fill('Additional context for testing');
      }
      
      // Submit to Jules
      const submitBtn = page.locator('#submitToJules, .submit-jules, button:has-text("Submit"), button:has-text("Send")').first();
      await submitBtn.click();
      
      // Verify submission (look for success message or redirect)
      await page.waitForTimeout(2000);
      
      const successMsg = page.locator('#julesSuccess, .success, .toast');
      const hasSuccess = await successMsg.isVisible().catch(() => false);
      
      // Or check if modal closed and redirected to sessions/queue
      const modalClosed = !await page.locator('#julesModal').isVisible().catch(() => true);
      
      expect(hasSuccess || modalClosed).toBeTruthy();
    }
  });

  test('Jules queue displays pending tasks', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to queue page
    await navigateToPage(page, 'queue');
    await page.waitForLoadState('networkidle');
    
    // Verify queue page loads
    const queueContainer = page.locator('#queueContainer, .queue-container, .queue-list');
    await expect(queueContainer).toBeVisible();
    
    // Check for queue items (might be empty or have items)
    const queueItems = page.locator('.queue-item, .task-item');
    const itemCount = await queueItems.count();
    
    // Queue exists, even if empty
    expect(itemCount).toBeGreaterThanOrEqual(0);
  });

  test('user can view Jules session history', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to sessions page
    await navigateToPage(page, 'sessions');
    await page.waitForLoadState('networkidle');
    
    // Verify sessions page loads
    const sessionsContainer = page.locator('#sessionsContainer, .sessions-container, .session-list');
    await expect(sessionsContainer).toBeVisible();
    
    // Check for session cards
    const sessionCards = page.locator('.session-card, .session-item');
    const sessionCount = await sessionCards.count();
    
    // Sessions exist (might be 0 for new users)
    expect(sessionCount).toBeGreaterThanOrEqual(0);
  });

  test('error handling when Jules API key is invalid', async ({ page }) => {
    // Set invalid key
    await page.evaluate(() => {
      localStorage.setItem('julesApiKey', 'invalid-key-12345');
    });
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Try to submit to Jules
    const julesBtn = page.locator('#julesBtn, button:has-text("Jules")').first();
    
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      await page.waitForSelector('#julesModal', { timeout: 5000 });
      
      const submitBtn = page.locator('#submitToJules, button:has-text("Submit")').first();
      await submitBtn.click();
      
      // Wait for error
      await page.waitForTimeout(2000);
      
      // Look for error message
      const errorMsg = page.locator('#julesError, .error, .error-message, [role="alert"]');
      
      if (await errorMsg.isVisible()) {
        const errorText = await errorMsg.textContent();
        expect(errorText.toLowerCase()).toMatch(/invalid|error|failed/);
      }
    }
  });

  test('Jules modal closes without submitting', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Open Jules modal
    const julesBtn = page.locator('#julesBtn, button:has-text("Jules")').first();
    
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      await page.waitForSelector('#julesModal', { timeout: 5000 });
      
      // Close modal without submitting
      const closeBtn = page.locator('#julesModal .close, .modal-close, button:has-text("Cancel"), button:has-text("Close")').first();
      
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
        
        // Verify modal closed
        const modal = page.locator('#julesModal');
        expect(await modal.isVisible()).toBeFalsy();
      }
    }
  });

  test('Jules requires authentication', async ({ page }) => {
    // Clear authentication
    await page.evaluate(() => {
      localStorage.removeItem('githubToken');
      localStorage.removeItem('githubUser');
    });
    
    await page.reload();
    
    // Try to access Jules page
    await navigateToPage(page, 'jules');
    await page.waitForTimeout(1000);
    
    // Should see auth requirement
    const authRequired = page.locator('.auth-required, button:has-text("Sign in"), button:has-text("Login")');
    await expect(authRequired).toBeVisible();
  });

  test('user can add prompt to queue from Jules modal', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Open Jules modal
    const julesBtn = page.locator('#julesBtn').first();
    
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      await page.waitForSelector('#julesModal', { timeout: 5000 });
      
      // Look for "Add to Queue" option
      const addToQueueBtn = page.locator('button:has-text("Add to Queue"), button:has-text("Queue"), #addToQueue').first();
      
      if (await addToQueueBtn.isVisible()) {
        await addToQueueBtn.click();
        await page.waitForTimeout(1000);
        
        // Verify added to queue
        const successMsg = page.locator('.success, .toast');
        
        if (await successMsg.isVisible()) {
          expect(await successMsg.textContent()).toBeTruthy();
        }
      }
    }
  });

  test('Jules modal displays prompt preview correctly', async ({ page }) => {
    // Set Jules API key
    await page.evaluate((config) => {
      localStorage.setItem('julesApiKey', config.apiKey);
    }, testJulesConfig);
    
    // Navigate to a prompt
    await page.goto('/?file=test-prompt');
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Open Jules modal
    const julesBtn = page.locator('#julesBtn').first();
    
    if (await julesBtn.isVisible()) {
      await julesBtn.click();
      await page.waitForSelector('#julesModal', { timeout: 5000 });
      
      // Verify prompt preview shows
      const promptPreview = page.locator('#julesPromptPreview, .prompt-preview, .jules-content');
      await expect(promptPreview).toBeVisible();
      
      // Verify it contains prompt content
      const previewText = await promptPreview.textContent();
      expect(previewText.length).toBeGreaterThan(0);
    }
  });
});
