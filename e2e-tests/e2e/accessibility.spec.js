import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have any automatically detectable accessibility issues', async ({ page }) => {
  await page.goto('/');
  // Wait for content to ensure page is loaded
  await page.waitForSelector('body');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .disableRules(['page-has-heading-one'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
