import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/unit-tests/**/*.{test,spec}.js'],
    
    // Fail tests if they take too long
    testTimeout: 5000,
    
    // Show console.log in tests (helpful for debugging)
    silent: false,
    
    // Coverage configuration with thresholds
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      
      // Start with current coverage levels, raise as tests are added
      thresholds: {
        lines: 10,
        functions: 24,
        branches: 50, // Currently meeting this
        statements: 10,
      },
      
      // Don't measure test files or config
      exclude: [
        'src/unit-tests/**',
        'vitest.config.js',
        'src/firebase-init.js',
        'src/font-init.js',
        '**/node_modules/**',
      ],
      
      // Per-file thresholds for critical modules
      perFile: true,
      
      // Include all source files even if not imported by tests
      all: true,
      include: ['src/modules/**/*.js', 'src/utils/**/*.js'],
    },
    
    // Setup file to run before all tests
    setupFiles: ['./src/unit-tests/setup.js'],
  },
});
