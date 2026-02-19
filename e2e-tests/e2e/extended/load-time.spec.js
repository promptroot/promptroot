import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('homepage loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('#list, main', { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    
    console.log(`Homepage load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // 5 seconds max (generous for E2E)
  });

  test('prompt rendering is fast', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    const startTime = Date.now();
    
    // Click first file
    const firstFile = page.locator('.item').first();
    await firstFile.click();
    await page.waitForSelector('#content, .content-area', { timeout: 5000 });
    
    const renderTime = Date.now() - startTime;
    
    console.log(`Prompt render time: ${renderTime}ms`);
    expect(renderTime).toBeLessThan(2000); // 2 seconds max
  });

  test('large file tree renders efficiently', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 15000 });
    
    // Wait for file tree to be populated
    await page.waitForSelector('.item', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`File tree load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(10000); // 10 seconds max for large repos
  });

  test('navigation between prompts is smooth', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    // Click first prompt
    await page.locator('.item').first().click();
    await page.waitForSelector('#content', { timeout: 5000 });
    
    // Measure time to switch to another prompt
    const startTime = Date.now();
    await page.locator('.item').nth(1).click();
    await page.waitForSelector('#content', { timeout: 5000 });
    const switchTime = Date.now() - startTime;
    
    console.log(`Prompt switch time: ${switchTime}ms`);
    expect(switchTime).toBeLessThan(1500); // 1.5 seconds max
  });

  test('page does not have memory leaks after multiple navigations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#list', { timeout: 10000 });
    
    // Get initial metrics
    const initialMetrics = await page.evaluate(() => {
      return {
        memory: performance.memory?.usedJSHeapSize || 0,
        nodes: document.querySelectorAll('*').length
      };
    });
    
    // Navigate between multiple prompts
    const files = await page.locator('.item').all();
    const filesToTest = files.slice(0, Math.min(5, files.length));
    
    for (const file of filesToTest) {
      await file.click();
      await page.waitForTimeout(500);
    }
    
    // Get final metrics
    const finalMetrics = await page.evaluate(() => {
      return {
        memory: performance.memory?.usedJSHeapSize || 0,
        nodes: document.querySelectorAll('*').length
      };
    });
    
    console.log('Initial metrics:', initialMetrics);
    console.log('Final metrics:', finalMetrics);
    
    // Memory should not grow excessively (allow 50% growth)
    if (initialMetrics.memory > 0) {
      const memoryGrowth = (finalMetrics.memory - initialMetrics.memory) / initialMetrics.memory;
      console.log(`Memory growth: ${(memoryGrowth * 100).toFixed(2)}%`);
      expect(memoryGrowth).toBeLessThan(0.5);
    }
  });

  test('images and assets load efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Check resource timing
    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const images = resources.filter(r => r.initiatorType === 'img');
      const scripts = resources.filter(r => r.initiatorType === 'script');
      const styles = resources.filter(r => r.initiatorType === 'link');
      
      return {
        imageCount: images.length,
        scriptCount: scripts.length,
        styleCount: styles.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
      };
    });
    
    console.log('Resource metrics:', resourceMetrics);
    
    // Total page size should be reasonable (< 5MB)
    expect(resourceMetrics.totalSize).toBeLessThan(5 * 1024 * 1024);
  });

  test('Core Web Vitals are within acceptable ranges', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Get Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const result = {};
        
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          result.lcp = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // FID (First Input Delay) - can't easily test in automation
        // CLS (Cumulative Layout Shift)
        new PerformanceObserver((list) => {
          let cls = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
          result.cls = cls;
        }).observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => resolve(result), 3000);
      });
    });
    
    console.log('Core Web Vitals:', vitals);
    
    // LCP should be < 2.5s (good), < 4s (acceptable)
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(4000);
    }
    
    // CLS should be < 0.1 (good), < 0.25 (acceptable)
    if (vitals.cls !== undefined) {
      expect(vitals.cls).toBeLessThan(0.25);
    }
  });
});
