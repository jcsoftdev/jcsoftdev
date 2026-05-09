/**
 * E2E — web-shell happy-path flow
 *
 * Tests the web shell structure: HeroIsland CTAs + Header navigation + active-link state.
 *
 * Scenarios covered:
 *   1. Home page renders HeroIsland heading and both CTA anchors
 *   2. "View Portfolio →" CTA navigates to /portfolio (status 200)
 *   3. "Read Blog →" CTA navigates to /blog
 *   4. Header nav links visible across pages (/, /portfolio, /blog)
 *   5. Header active-link: visiting /portfolio sets aria-current="page" on "Portfolio" link
 *   6. Header active-link: visiting /blog sets aria-current="page" on "Blog" link
 *   7. Header active-link: home page has no aria-current on Portfolio or Blog links
 *
 * Prerequisites (all must be running):
 *   - Web → http://localhost:4321
 *
 * These specs are dev-only and NOT blocking in CI (continue-on-error: true in e2e job).
 * Run with: pnpm exec playwright test e2e/web-shell.spec.ts
 *
 * Seed data is NOT required — these tests exercise the shell structure only,
 * not portfolio content or blog posts.
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:4321';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('web-shell E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 1. HeroIsland — heading and CTAs ─────────────────────────────────────

  test('1 — home page renders HeroIsland heading "jcsoftdev"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    // HeroIsland renders a heading containing the site name
    await expect(page.getByRole('heading', { name: /jcsoftdev/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('2 — "View Portfolio →" CTA is visible with href="/portfolio"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const portfolioCta = page.getByRole('link', { name: /view portfolio/i });
    await expect(portfolioCta).toBeVisible({ timeout: 15_000 });
    await expect(portfolioCta).toHaveAttribute('href', '/portfolio');
  });

  test('3 — "Read Blog →" CTA is visible with href="/blog"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const blogCta = page.getByRole('link', { name: /read blog/i });
    await expect(blogCta).toBeVisible({ timeout: 15_000 });
    await expect(blogCta).toHaveAttribute('href', '/blog');
  });

  // ── 2. CTA navigation ────────────────────────────────────────────────────

  test('4 — clicking "View Portfolio →" navigates to /portfolio with status 200', async ({
    page,
    request,
  }) => {
    // Verify the route responds with 200 via API request first
    const res = await request.get(`${WEB_URL}/portfolio`);
    expect(res.ok()).toBeTruthy();

    // Then verify CTA navigation in browser
    await page.goto(`${WEB_URL}/`);
    const portfolioCta = page.getByRole('link', { name: /view portfolio/i });
    await expect(portfolioCta).toBeVisible({ timeout: 15_000 });
    await portfolioCta.click();
    await page.waitForURL(`${WEB_URL}/portfolio`, { timeout: 10_000 });
    expect(page.url()).toContain('/portfolio');
  });

  test('5 — clicking "Read Blog →" navigates to /blog', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    const blogCta = page.getByRole('link', { name: /read blog/i });
    await expect(blogCta).toBeVisible({ timeout: 15_000 });
    await blogCta.click();
    await page.waitForURL(`${WEB_URL}/blog`, { timeout: 10_000 });
    expect(page.url()).toContain('/blog');
  });

  // ── 3. Header nav across pages ───────────────────────────────────────────

  test('6 — header nav links visible on home page (/, /portfolio, /blog)', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15_000 });

    // Brand link
    await expect(header.getByRole('link', { name: 'jcsoftdev' })).toBeVisible();

    // Nav links
    await expect(header.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  });

  test('7 — header nav links visible on /portfolio page', async ({ page }) => {
    await page.goto(`${WEB_URL}/portfolio`);

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header.getByRole('link', { name: 'jcsoftdev' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  });

  test('8 — header nav links visible on /blog page', async ({ page }) => {
    await page.goto(`${WEB_URL}/blog`);

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header.getByRole('link', { name: 'jcsoftdev' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Blog' })).toBeVisible();
  });

  // ── 4. Header active-link state ──────────────────────────────────────────

  test('9 — /portfolio: "Portfolio" link has aria-current="page", "Blog" does not', async ({
    page,
  }) => {
    await page.goto(`${WEB_URL}/portfolio`);

    const portfolioLink = page.locator('header nav a[href="/portfolio"]');
    const blogLink = page.locator('header nav a[href="/blog"]');

    await expect(portfolioLink).toBeVisible({ timeout: 15_000 });
    await expect(portfolioLink).toHaveAttribute('aria-current', 'page');
    await expect(blogLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('10 — /blog: "Blog" link has aria-current="page", "Portfolio" does not', async ({
    page,
  }) => {
    await page.goto(`${WEB_URL}/blog`);

    const portfolioLink = page.locator('header nav a[href="/portfolio"]');
    const blogLink = page.locator('header nav a[href="/blog"]');

    await expect(blogLink).toBeVisible({ timeout: 15_000 });
    await expect(blogLink).toHaveAttribute('aria-current', 'page');
    await expect(portfolioLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('11 — /: neither "Portfolio" nor "Blog" has aria-current="page"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const portfolioLink = page.locator('header nav a[href="/portfolio"]');
    const blogLink = page.locator('header nav a[href="/blog"]');

    await expect(portfolioLink).toBeVisible({ timeout: 15_000 });
    await expect(portfolioLink).not.toHaveAttribute('aria-current', 'page');
    await expect(blogLink).not.toHaveAttribute('aria-current', 'page');
  });
});
