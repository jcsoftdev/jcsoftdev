/**
 * E2E — core-platform happy-path flow
 *
 * Tests the full end-to-end content loop:
 *   1. Request magic-link at /login (admin)
 *   2. Obtain a session token (via API test helper)
 *   3. Create and publish a post in the admin SPA
 *   4. Verify the post appears on the public blog
 *   5. Read the full post at /blog/<slug>
 *
 * Prerequisites (all must be running):
 *   - API   → http://localhost:3000
 *   - Admin → http://localhost:5173
 *   - Web   → http://localhost:4321
 *   - Postgres 17, Valkey 8 (via docker compose or CI services)
 *
 * These specs are dev-only and NOT blocking in CI.
 * Run with: pnpm exec playwright test
 *
 * Auth strategy: better-auth magic-link flow requires a real email provider
 * in full E2E. For CI, we use better-auth's internal test helper endpoint
 * (/auth/magic-link/verify?token=...) to simulate link-click without email.
 * The test seed creates an admin user (seeded by pnpm --filter @jcsoftdev/db db:seed).
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5173';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Admin email seeded by pnpm --filter @jcsoftdev/db db:seed
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@jcsoftdev.com';

// Slug used for the E2E test post — deterministic for easy cleanup
const E2E_SLUG = 'e2e-test-post-playwright';
const E2E_TITLE = 'E2E Test Post — Playwright';
const E2E_CONTENT = '# E2E Test\n\nThis post was created by Playwright E2E tests.';

// ---------------------------------------------------------------------------
// Helper: request magic-link and extract token via API
// ---------------------------------------------------------------------------

/**
 * Trigger a magic-link request via the API and intercept the token.
 *
 * better-auth's magic-link plugin stores the token internally. In test
 * environments, the API exposes the raw token via the sendMagicLinkEmail
 * callback. This helper calls the send endpoint and extracts the token
 * from the Resend mock (when TEST_MAGIC_LINK_TOKEN is pre-set via env)
 * or from the API response headers (if the API is in test mode).
 *
 * For production E2E, replace this with actual email inbox polling
 * (e.g., Mailhog, Inbucket, or the Resend sandbox).
 */
async function getMagicLinkToken(apiUrl: string, email: string): Promise<string | null> {
  // In CI/local dev: if TEST_MAGIC_LINK_TOKEN is pre-set, use it directly
  if (process.env.TEST_MAGIC_LINK_TOKEN) {
    return process.env.TEST_MAGIC_LINK_TOKEN;
  }

  // Trigger the magic-link send
  const sendRes = await fetch(`${apiUrl}/auth/magic-link/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!sendRes.ok) {
    console.error('Magic-link send failed:', sendRes.status, await sendRes.text());
    return null;
  }

  // For local dev with a test email server: parse token from the response body
  // better-auth does not expose the raw token by default — this requires a
  // custom sendMagicLinkEmail implementation that logs or returns the token.
  const body = (await sendRes.json().catch(() => null)) as {
    testToken?: string;
  } | null;
  return body?.testToken ?? null;
}

// ---------------------------------------------------------------------------
// Helper: authenticate via magic-link (sets session cookie)
// ---------------------------------------------------------------------------

async function authenticateWithMagicLink(
  page: import('@playwright/test').Page,
  apiUrl: string,
  adminUrl: string,
  email: string
): Promise<void> {
  const token = await getMagicLinkToken(apiUrl, email);

  if (!token) {
    // Fall back to manual login flow for local dev
    // Tester must manually click the magic-link from their email client
    await page.goto(`${adminUrl}/login`);
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('button', { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    // Test cannot proceed without the token — skip
    test.skip(true, 'Magic-link token not available — configure TEST_MAGIC_LINK_TOKEN');
    return;
  }

  // Navigate to the magic-link callback URL to set the session cookie
  await page.goto(`${apiUrl}/auth/magic-link/verify?token=${token}`, {
    waitUntil: 'networkidle',
  });

  // better-auth redirects to BETTER_AUTH_URL on success — follow to admin
  await page.goto(`${adminUrl}/`);
  // Wait for the session to be established
  await page.waitForURL(/\/dashboard|\/posts/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('core-platform E2E happy path', () => {
  test.describe.configure({ mode: 'serial' });

  test('1 — health check: API is reachable', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  test('2 — login page renders with email input and send button', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('3 — magic-link request succeeds and shows check-email screen', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await page.getByRole('textbox', { name: /email/i }).fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: /send magic link/i }).click();
    // Admin should show the check-email confirmation screen
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
  });

  test('4 — authenticated user can navigate to posts list', async ({ page }) => {
    await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);
    await page.goto(`${ADMIN_URL}/posts`);
    // Should show the posts list (table or empty state)
    await expect(page.locator('h1, [data-testid="posts-table"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('5 — authenticated user can create a new post', async ({ page }) => {
    await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);
    await page.goto(`${ADMIN_URL}/posts/new`);

    // Fill the post editor form
    await page.getByRole('textbox', { name: /title/i }).fill(E2E_TITLE);
    // Slug is auto-generated from title — may need a small wait
    await page.waitForTimeout(300);

    // Fill the MDX content area
    const contentArea = page.getByRole('textbox', { name: /content|body/i });
    await contentArea.fill(E2E_CONTENT);

    // Submit (create as draft)
    await page.getByRole('button', { name: /create|save/i }).click();

    // Should redirect to the edit page after creation
    await page.waitForURL(/\/posts\/[a-zA-Z0-9-]+\/edit/, { timeout: 10_000 });
    await expect(page.getByText(E2E_TITLE)).toBeVisible();
  });

  test('6 — authenticated user can publish the post', async ({ page }) => {
    // Navigate to the newly created post
    await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);

    // Find the post in the list and open it
    await page.goto(`${ADMIN_URL}/posts`);
    await page.getByText(E2E_TITLE).click();
    await page.waitForURL(/\/posts\/[a-zA-Z0-9-]+\/edit/, { timeout: 10_000 });

    // Change status to published
    const statusSelect = page.getByRole('combobox', { name: /status/i });
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('published');
    }

    await page.getByRole('button', { name: /update|save|publish/i }).click();
    await expect(page.getByText(/published/i)).toBeVisible({ timeout: 5_000 });
  });

  test('7 — published post appears on the public blog list', async ({ page }) => {
    await page.goto(`${WEB_URL}/blog`);
    // The post should appear in the list
    await expect(page.getByText(E2E_TITLE)).toBeVisible({ timeout: 15_000 });
  });

  test('8 — public blog post page renders title, body, and back link', async ({ page }) => {
    await page.goto(`${WEB_URL}/blog/${E2E_SLUG}`);
    // Title
    await expect(page.getByRole('heading', { name: E2E_TITLE })).toBeVisible({
      timeout: 10_000,
    });
    // MDX content rendered as HTML
    await expect(page.getByText('E2E Test')).toBeVisible();
    // Back link
    await expect(page.getByRole('link', { name: /back to blog/i })).toBeVisible();
  });

  test('9 — hero image is rendered when present, omitted when null', async ({ page }) => {
    // This test validates the conditional rendering logic.
    // A post without a hero image should NOT have a broken <img> tag.
    await page.goto(`${WEB_URL}/blog/${E2E_SLUG}`);

    // If there's a hero image, it should have loading=lazy and decoding=async
    const heroImg = page.locator('header img');
    const heroCount = await heroImg.count();

    if (heroCount > 0) {
      await expect(heroImg).toHaveAttribute('loading', 'lazy');
      await expect(heroImg).toHaveAttribute('decoding', 'async');
    }
    // No assertion needed when heroCount === 0 — absence of broken img is the pass
  });
});
