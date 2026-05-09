import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Exclude integration tests from the default test run.
    // Integration tests require Docker (Testcontainers) and are slow.
    // Run them explicitly: pnpm --filter @jcsoftdev/db test:integration
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
  },
});
