import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment
    environment: 'happy-dom',

    // Globals (optional, consente di usare describe/it/expect senza import)
    globals: true,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.js',
        '**/mockData.js',
        '**/*.test.js',
      ],
    },

    // Setup files
    setupFiles: ['./src/__tests__/setup.js'],

    // Include/Exclude patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs}'],
    exclude: ['node_modules', 'dist'],

    // Watch mode options
    watch: false, // default: true in dev, false in CI
  },
});
