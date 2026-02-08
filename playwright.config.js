import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-tests/e2e',
  fullyParallel: false,  // E2E tests run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,  // More retries in CI for browser crashes
  workers: process.env.CI ? 1 : 1,
  timeout: process.env.CI ? 90000 : 30000,  // 90s in CI for slow environments
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }]
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: process.env.CI ? 15000 : 10000,  // Longer waits in CI
    navigationTimeout: process.env.CI ? 30000 : 15000,  // Longer navigation in CI
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Start local dev server before tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
