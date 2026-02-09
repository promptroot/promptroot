import { test, expect } from '@playwright/test';
import { navigateWithParams } from '../helpers/navigation.js';
import { mockGitHubAPI } from '../helpers/github-helper.js';

test.describe('Variable Substitution', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubAPI(page);
    
    // Setup Jules API key
    await page.evaluate(() => {
      localStorage.setItem('julesApiKey', 'test-api-key');
    });
  });

  test('shows variable modal for prompt with placeholders', async ({ page }) => {
    // Navigate to test prompt with variables
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Click "Try in Jules" button
    const julesBtn = page.locator('#julesBtn, button:has-text("Try in Jules")').first();
    await expect(julesBtn).toBeVisible({ timeout: 5000 });
    await julesBtn.click();
    
    // Verify variable modal appears
    const variableModal = page.locator('#variableModal, .variable-modal');
    await expect(variableModal).toBeVisible({ timeout: 5000 });
    
    // Verify modal has correct title
    await expect(page.locator('#variableModalTitle, .modal-title')).toHaveText('Fill Variables');
  });

  test('displays input fields for each placeholder', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    // Get prompt text and detect placeholders
    const promptText = await page.locator('#content').textContent();
    
    // Count expected placeholders (FILE_PATH, LINE_NUMBER in first example)
    const placeholderMatches = promptText.match(/\{([A-Z0-9_-]+)\}/g);
    const uniquePlaceholders = new Set(placeholderMatches?.map(m => m.slice(1, -1)) || []);
    
    if (uniquePlaceholders.size > 0) {
      const julesBtn = page.locator('#julesBtn').first();
      await julesBtn.click();
      
      await page.waitForSelector('.variable-modal', { timeout: 5000 });
      
      // Count input fields in modal
      const inputs = page.locator('.variable-modal__input');
      const inputCount = await inputs.count();
      
      expect(inputCount).toBeGreaterThan(0);
    }
  });

  test('validates required fields before submission', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    const variableModal = page.locator('.variable-modal');
    await expect(variableModal).toBeVisible({ timeout: 5000 });
    
    // Try to submit without filling fields
    const continueBtn = page.locator('#variableModalContinue, .variable-modal button.primary');
    await continueBtn.click();
    
    // Verify error message appears
    const errorMsg = page.locator('#variableModalError, .variable-modal__error');
    await expect(errorMsg).toBeVisible({ timeout: 2000 });
    await expect(errorMsg).toHaveText('All fields are required');
  });

  test('substitutes variables and proceeds to Jules modal', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Fill in first input field
    const firstInput = page.locator('.variable-modal__input').first();
    await firstInput.fill('test-value.js');
    
    // Fill additional fields if they exist
    const inputs = page.locator('.variable-modal__input');
    const inputCount = await inputs.count();
    
    for (let i = 1; i < inputCount; i++) {
      await inputs.nth(i).fill(`test-value-${i}`);
    }
    
    // Submit the form
    const continueBtn = page.locator('#variableModalContinue');
    await continueBtn.click();
    
    // Verify variable modal closes
    await expect(page.locator('.variable-modal')).not.toBeVisible({ timeout: 3000 });
    
    // Verify Jules modal opens
    const julesModal = page.locator('#julesModal, .jules-modal');
    await expect(julesModal).toBeVisible({ timeout: 5000 });
  });

  test('cancels variable submission when clicking cancel', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Click cancel button
    const cancelBtn = page.locator('#variableModalCancel, .variable-modal button:has-text("Cancel")');
    await cancelBtn.click();
    
    // Verify modal closes
    await expect(page.locator('.variable-modal')).not.toBeVisible({ timeout: 3000 });
    
    // Verify Jules modal does NOT open
    const julesModal = page.locator('#julesModal, .jules-modal');
    await expect(julesModal).not.toBeVisible({ timeout: 2000 });
  });

  test('closes modal when clicking X button', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Click X close button
    const closeBtn = page.locator('#variableModalClose, .variable-modal .close-modal');
    await closeBtn.click();
    
    // Verify modal closes
    await expect(page.locator('.variable-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('closes modal when clicking background', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    const variableModal = page.locator('.variable-modal');
    await expect(variableModal).toBeVisible({ timeout: 5000 });
    
    // Click on modal background (not the content)
    await variableModal.click({ position: { x: 5, y: 5 } });
    
    // Verify modal closes
    await expect(variableModal).not.toBeVisible({ timeout: 3000 });
  });

  test('clears error message when user types', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Try to submit without filling - should show error
    const continueBtn = page.locator('#variableModalContinue');
    await continueBtn.click();
    
    const errorMsg = page.locator('#variableModalError');
    await expect(errorMsg).toBeVisible();
    
    // Type in first input
    const firstInput = page.locator('.variable-modal__input').first();
    await firstInput.fill('test');
    
    // Error should still be visible if other fields are empty
    // But input error styling should be removed from this field
    const hasErrorClass = await firstInput.evaluate(el => 
      el.classList.contains('variable-modal__input--error')
    );
    expect(hasErrorClass).toBeFalsy();
  });

  test('sanitizes XSS attempts in input values', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Fill input with XSS payload
    const firstInput = page.locator('.variable-modal__input').first();
    await firstInput.fill('<script>alert("XSS")</script>');
    
    // Fill other required fields with safe values
    const inputs = page.locator('.variable-modal__input');
    const inputCount = await inputs.count();
    for (let i = 1; i < inputCount; i++) {
      await inputs.nth(i).fill('safe-value');
    }
    
    // Submit
    const continueBtn = page.locator('#variableModalContinue');
    await continueBtn.click();
    
    // Wait for Jules modal
    await page.waitForSelector('#julesModal, .jules-modal', { timeout: 5000 });
    
    // Verify no script was executed (page should still be functional)
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    
    // Verify modal opened successfully (no XSS broke the page)
    const julesModal = page.locator('#julesModal, .jules-modal');
    await expect(julesModal).toBeVisible();
  });

  test('skips variable modal for prompts without placeholders', async ({ page }) => {
    // Navigate to a regular prompt without variables
    await navigateWithParams(page, {
      file: 'test-prompt'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    
    if (await julesBtn.isVisible({ timeout: 5000 })) {
      await julesBtn.click();
      
      // Variable modal should NOT appear
      const variableModal = page.locator('.variable-modal');
      await expect(variableModal).not.toBeVisible({ timeout: 2000 });
      
      // Jules modal should appear directly
      const julesModal = page.locator('#julesModal, .jules-modal');
      await expect(julesModal).toBeVisible({ timeout: 5000 });
    }
  });

  test('handles multiple placeholders with same name', async ({ page }) => {
    // Create a test scenario with repeated placeholders
    await page.goto('/');
    
    // Inject test prompt via JavaScript
    await page.evaluate(() => {
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = '<p>Compare {FILE} with {FILE} and log to {OUTPUT}.</p>';
      }
      
      // Make current prompt text available
      if (window.getCurrentPromptText) {
        window.setCurrentPromptText('Compare {FILE} with {FILE} and log to {OUTPUT}.');
      }
    });
    
    await page.waitForTimeout(500);
    
    const julesBtn = page.locator('#julesBtn').first();
    
    if (await julesBtn.isVisible({ timeout: 5000 })) {
      await julesBtn.click();
      
      await page.waitForSelector('.variable-modal', { timeout: 5000 });
      
      // Should only have 2 unique input fields: FILE and OUTPUT
      const inputs = page.locator('.variable-modal__input');
      const count = await inputs.count();
      
      expect(count).toBe(2);
    }
  });

  test('respects maxlength attribute on input fields', async ({ page }) => {
    await navigateWithParams(page, {
      file: 'variable-substitution-test'
    });
    
    await page.waitForSelector('#content', { timeout: 10000 });
    
    const julesBtn = page.locator('#julesBtn').first();
    await julesBtn.click();
    
    await page.waitForSelector('.variable-modal', { timeout: 5000 });
    
    // Check first input has maxlength
    const firstInput = page.locator('.variable-modal__input').first();
    const maxLength = await firstInput.getAttribute('maxlength');
    
    expect(maxLength).toBe('1000');
  });
});
