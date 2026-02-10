import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'out/',
        'src/test/',
        '**/*.test.ts',
      ],
    },
    alias: {
      vscode: 'vitest-mock',
    },
    setupFiles: ['./src/test-setup.ts'],
  },
});
