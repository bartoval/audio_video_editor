import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// CHROMIUM_PATH: optional, for environments where Playwright's own browser is not installed
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      // Vitest 4 reads headless here, not from the provider's launch options
      headless: true,
      provider: playwright({
        launchOptions: executablePath ? { executablePath } : {}
      }),
      instances: [{ browser: 'chromium' }]
    },

    include: ['tests/integration/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./tests/integration/setup.js'],
    testTimeout: 10000,
    globals: true
  }
});
