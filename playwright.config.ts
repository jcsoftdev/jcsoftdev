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
 * In CI, Playwright starts the three apps itself via the webServer block below.
 * That claim used to be made in this comment while nothing actually started
 * them, so every spec failed to connect — and because the job is
 * continue-on-error, it stayed red for months without anyone reading it.
 */

import { defineConfig, devices } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5173';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Dev servers are slower to boot cold in CI than on a warm local machine.
const SERVER_TIMEOUT = process.env.CI ? 180_000 : 60_000;

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

  // Playwright owns the app lifecycle. reuseExistingServer keeps the local
  // workflow intact: with `pnpm dev` already running, these are no-ops.
  webServer: [
    {
      command: 'pnpm --filter @jcsoftdev/api dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_TIMEOUT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @jcsoftdev/admin dev',
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_TIMEOUT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @jcsoftdev/web dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_TIMEOUT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
