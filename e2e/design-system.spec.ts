/**
 * E2E — design-system-immersive smoke suite
 *
 * Validates the Phase 7 deliverables at the HTTP + DOM level:
 *   1. Home page — 200 status + hero text "Juan Carlos Valencia" present
 *   2. /portfolio — 200 status + page renders
 *   3. /blog — 200 status + "Writing" section present
 *   4. /blog/[slug] — skipped gracefully if no posts are seeded
 *   5. /nonexistent — 404 status + "404" text in DOM
 *
 * Prerequisites (all must be running):
 *   - Web → http://localhost:4321
 *
 * These specs are dev-only and NOT blocking in CI (continue-on-error: true in e2e job).
 * Run with: pnpm exec playwright test e2e/design-system.spec.ts
 *
 * Seed data is NOT required for tests 1–3, 5.
 * Test 4 requires at least one published post — skips gracefully if none exist.
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:4321';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('design-system-immersive E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 1. Home page ─────────────────────────────────────────────────────────

  test('1 — home page returns 200 and hero text "Juan Carlos Valencia" is visible', async ({
    page,
    request,
  }) => {
    // HTTP-level check first
    const res = await request.get(`${WEB_URL}/`);
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    // DOM check
    await page.goto(`${WEB_URL}/`);
    // HeroIsland renders the name in a [data-hero-title] element
    const heroTitle = page.locator('[data-hero-title]');
    await expect(heroTitle).toBeVisible({ timeout: 15_000 });
    await expect(heroTitle).toContainText(/Juan Carlos Valencia/i);
  });

  // ── 2. Portfolio page ─────────────────────────────────────────────────────

  test('2 — /portfolio returns 200 and page renders', async ({ page, request }) => {
    const res = await request.get(`${WEB_URL}/portfolio`);
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    await page.goto(`${WEB_URL}/portfolio`);

    // Page must have a <main> element — confirms SSR rendered the shell
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });
  });

  // ── 3. Blog index ─────────────────────────────────────────────────────────

  test('3 — /blog returns 200 and "Writing" section is present', async ({ page, request }) => {
    const res = await request.get(`${WEB_URL}/blog`);
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    await page.goto(`${WEB_URL}/blog`);

    // Phase 7.1 adds a SectionHeader with "Writing" title/eyebrow
    // Wait for the page to hydrate then assert the section heading text
    const heading = page.getByRole('heading', { name: /writing/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  // ── 4. Blog post (optional — requires seeded data) ────────────────────────

  test('4 — /blog/[slug] renders 200 when a post is available (skips gracefully)', async ({
    page,
    request,
  }) => {
    // Fetch the blog index to discover any available slugs
    const indexRes = await request.get(`${WEB_URL}/blog`);
    const indexHtml = await indexRes.text();

    // Look for any /blog/<slug> href — pattern: href="/blog/<something>"
    const slugMatch = indexHtml.match(/href="\/blog\/([^"]+)"/);

    if (!slugMatch) {
      // No posts seeded — skip gracefully
      test.skip();
      return;
    }

    const slug = slugMatch[1];
    const postUrl = `${WEB_URL}/blog/${slug}`;

    const res = await request.get(postUrl);
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    await page.goto(postUrl);

    // Post page must render an <article> element (Phase 7.2 structure)
    await expect(page.locator('article')).toBeVisible({ timeout: 15_000 });
  });

  // ── 5. 404 page ───────────────────────────────────────────────────────────

  test('5 — /nonexistent returns 404 and "404" text is visible in DOM', async ({
    page,
    request,
  }) => {
    // HTTP-level check
    const res = await request.get(`${WEB_URL}/nonexistent-page-dsi-test`);
    expect(res.status()).toBe(404);

    // DOM check — Phase 7.3 renders the 404.astro page with display "404" heading
    await page.goto(`${WEB_URL}/nonexistent-page-dsi-test`);

    // The 404 page renders a large display "404" heading
    const heading = page.getByRole('heading', { name: '404' });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Also verify "page not found" copy is present (Mono element below heading)
    await expect(page.getByText(/page not found/i)).toBeVisible({ timeout: 5_000 });
  });
});
