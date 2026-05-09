/**
 * Playwright E2E configuration — core-platform Phase 8
 *
 * These specs are dev-only and NOT picked up by Vitest (separate runner).
 * They are NOT blocking in CI — the e2e job sets continue-on-error: true.
 *
 * Run locally:
 *   # 1. Start services: pnpm dev (or pnpm dev:services + pnpm dev:apps)
 *   # 2. Run tests:      pnpm exec playwright test
 *
 * The specs assume all three apps are running:
 *   - API:   http://localhost:3000
 *   - Web:   http://localhost:4321
 *   - Admin: http://localhost:5173
 *
 * In CI, the e2e workflow job starts services and sets ADMIN_URL / WEB_URL env vars.
 */

import { defineConfig, devices } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5173';
// API_URL and WEB_URL are read directly via process.env in e2e specs, not needed here

export default defineConfig({
  testDir: './e2e',
  // E2E specs use .spec.ts — completely separate from Vitest *.test.ts files
  testMatch: '**/*.spec.ts',
  // Timeout per test (generous for SSR + auth flows)
  timeout: 30_000,
  // Retries on CI (flaky network), not locally
  retries: process.env.CI ? 2 : 0,
  // Run sequentially — auth state can be shared
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Base URL for admin app
    baseURL: ADMIN_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Extra headers for local dev CORS
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Env vars available in tests
  globalSetup: undefined,

  // Do NOT start any webServer automatically in this config.
  // Specs assume pnpm dev is already running (or CI starts services manually).
  // If you want auto-start for CI, uncomment the block below and adjust:
  //
  // webServer: [
  //   {
  //     command: 'pnpm --filter @jcsoftdev/api dev',
  //     url: API_URL,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  //   {
  //     command: 'pnpm --filter @jcsoftdev/admin dev',
  //     url: ADMIN_URL,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  //   {
  //     command: 'pnpm --filter @jcsoftdev/web dev',
  //     url: WEB_URL,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  // ],
});
