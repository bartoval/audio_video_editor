import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright({
        launch: { headless: true }
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
