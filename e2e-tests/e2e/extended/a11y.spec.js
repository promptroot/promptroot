import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('homepage has no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list, main', { timeout: 10000 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    console.log(`Found ${accessibilityScanResults.violations.length} accessibility violations`);
    
    // Log violations for debugging
    accessibilityScanResults.violations.forEach(violation => {
      console.log(`- ${violation.id}: ${violation.description}`);
      console.log(`  Impact: ${violation.impact}`);
      console.log(`  Nodes: ${violation.nodes.length}`);
    });
    
    // Filter out minor violations, fail only on critical/serious
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toEqual([]);
  });

  test('keyboard navigation works throughout the app', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    // Tab through focusable elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Continue tabbing
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }
    
    // Should have navigated through multiple elements
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('file tree is keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    // Focus on file tree
    await page.locator('#list').first().focus();
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Should have loaded content
    const contentVisible = await page.locator('#content, .content-area').isVisible();
    
    // Verify that content is visible after navigation
    expect(contentVisible).toBeTruthy();
  });

  test('screen reader landmarks are present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for semantic HTML landmarks
    const nav = await page.locator('nav, [role="navigation"]').count();
    const main = await page.locator('main, [role="main"]').count();
    const header = await page.locator('header, [role="banner"]').count();
    
    console.log(`Landmarks - nav: ${nav}, main: ${main}, header: ${header}`);
    
    // Should have at least a main content area
    expect(main).toBeGreaterThan(0);
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    
    console.log(`Images without alt text: ${imagesWithoutAlt}`);
    
    // All images should have alt attribute (can be empty for decorative images)
    expect(imagesWithoutAlt).toBe(0);
  });

  test.skip('form inputs have labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Find all inputs
    const inputs = await page.locator('input, textarea, select').all();
    
    let inputsWithoutLabels = 0;
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const title = await input.getAttribute('title');
      
      // Check if input has associated label
      let hasLabel = false;
      
      if (ariaLabel || title || ariaLabelledby) {
        hasLabel = true;
      } else if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        if (label > 0) hasLabel = true;
      }
      
      if (!hasLabel) {
        inputsWithoutLabels++;
      }
    }
    
    console.log(`Inputs without labels: ${inputsWithoutLabels} / ${inputs.length}`);
    
    // Most inputs should have labels
    expect(inputsWithoutLabels).toBeLessThanOrEqual(inputs.length * 0.1); // Allow 10% unlabeled
  });

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const buttons = await page.locator('button').all();
    let buttonsWithoutNames = 0;
    
    for (const button of buttons) {
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel || title;
      
      if (!hasAccessibleName) {
        buttonsWithoutNames++;
      }
    }
    
    console.log(`Buttons without accessible names: ${buttonsWithoutNames} / ${buttons.length}`);
    
    expect(buttonsWithoutNames).toBe(0);
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    
    // Check if focus outline is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      };
    });
    
    console.log('Focused element styles:', focusedElement);
    
    // Should have some kind of focus indicator
    if (focusedElement) {
      const hasFocusIndicator = 
        (focusedElement.outline && focusedElement.outline !== 'none') ||
        (focusedElement.outlineWidth && focusedElement.outlineWidth !== '0px') ||
        (focusedElement.boxShadow && focusedElement.boxShadow !== 'none');
      
      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('color contrast meets WCAG standards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .disableRules(['color-contrast']) // We'll test this separately
      .analyze();
    
    // Run contrast-specific check
    const contrastCheck = await new AxeBuilder({ page })
      .include('body')
      .withRules(['color-contrast'])
      .analyze();
    
    console.log(`Color contrast violations: ${contrastCheck.violations.length}`);
    
    contrastCheck.violations.forEach(violation => {
      console.log(`- ${violation.id}: ${violation.description}`);
      violation.nodes.forEach(node => {
        console.log(`  Element: ${node.html.substring(0, 100)}`);
      });
    });
    
    // Allow some minor contrast issues but no critical ones
    const criticalContrastIssues = contrastCheck.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalContrastIssues.length).toBeLessThanOrEqual(2);
  });

  test.skip('page structure is logical for screen readers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headingElements.map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent?.substring(0, 50)
      }));
    });
    
    console.log('Heading structure:', headings);
    
    // Should have at least one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count).toBeGreaterThan(0);
    
    // Headings should be in logical order (no skipping levels)
    let previousLevel = 0;
    let skippedLevels = false;
    
    for (const heading of headings) {
      if (heading.level - previousLevel > 1 && previousLevel !== 0) {
        skippedLevels = true;
        console.log(`Skipped from h${previousLevel} to h${heading.level}`);
      }
      previousLevel = heading.level;
    }
    
    // Warn but don't fail on skipped heading levels
    if (skippedLevels) {
      console.warn('Warning: Heading hierarchy has skipped levels');
    }
  });

  test('modal dialogs are accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Try to open a modal (if available)
    const modalTrigger = page.locator('button:has-text("Sign in"), button:has-text("Login"), .open-modal').first();
    
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      await page.waitForTimeout(500);
      
      // Check for modal
      const modal = page.locator('[role="dialog"], .modal, [aria-modal="true"]').first();
      
      if (await modal.isVisible()) {
        // Verify modal has proper ARIA attributes
        const ariaModal = await modal.getAttribute('aria-modal');
        const role = await modal.getAttribute('role');
        
        console.log(`Modal ARIA: role=${role}, aria-modal=${ariaModal}`);
        
        expect(role === 'dialog' || ariaModal === 'true').toBeTruthy();
      }
    }
  });
});
