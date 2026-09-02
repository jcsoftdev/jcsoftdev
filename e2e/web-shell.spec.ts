/**
 * E2E — web-shell happy-path flow
 *
 * Tests the web shell structure: HeroIsland CTAs + SideRail navigation +
 * active-link state.
 *
 * The site was rewritten from a top Header + separate /portfolio route to a
 * single-page rail layout (apps/web/src/components/SideRail.astro): the
 * portfolio content lives on `/` itself, the persistent chrome is a fixed
 * left rail on desktop (an `<aside>`, not a `<header>`) that collapses into a
 * mobile top bar + drawer below the `lg` breakpoint, and the hero's H1 no
 * longer renders "jcsoftdev" — it renders the author's name via
 * SignatureName (apps/web/src/components/SignatureName.tsx), exposed as an
 * accessible heading through `aria-label="Juan Carlos Valencia"`.
 *
 * Scenarios covered:
 *   1. Home page renders the hero heading "Juan Carlos Valencia"
 *   2. "View selected work" CTA is visible with href="#work"
 *   3. "Read the résumé" CTA is visible with href="/resume"
 *   4. Clicking "View selected work" jumps to the #work in-page anchor
 *   5. Clicking "Read the résumé" navigates to /resume
 *   6. SideRail (brand + "Writing"/"Résumé" links) is visible on /, /blog, /resume
 *   7. SideRail active-link: /blog sets aria-current="page" on "Writing"
 *   8. SideRail active-link: /resume sets aria-current="page" on "Résumé"
 *   9. SideRail active-link: / has no aria-current="page" on either route link
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

/** The desktop rail (`aside[data-site-chrome]`) is the only chrome instance
 *  visible at the default Desktop Chrome viewport (1280px, above Tailwind's
 *  1024px `lg` breakpoint) — the mobile top bar and bottom bar share the same
 *  `data-site-chrome` marker but are `lg:hidden`. Scoping to the `<aside>`
 *  avoids strict-mode collisions with the mobile drawer's duplicate links. */
const RAIL_SELECTOR = 'aside[data-site-chrome]';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('web-shell E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 1. HeroIsland — heading and CTAs ─────────────────────────────────────

  test('1 — home page renders the hero heading "Juan Carlos Valencia"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    // SignatureName renders the name as individual per-character spans inside
    // an <h1 aria-label="Juan Carlos Valencia">; the accessible name comes
    // from aria-label, and the concatenated character spans match visually.
    await expect(page.getByRole('heading', { name: /juan carlos valencia/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('2 — "View selected work" CTA is visible with href="#work"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const workCta = page.getByRole('link', { name: /view selected work/i });
    await expect(workCta).toBeVisible({ timeout: 15_000 });
    await expect(workCta).toHaveAttribute('href', '#work');
  });

  test('3 — "Read the résumé" CTA is visible with href="/resume"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const resumeCta = page.getByRole('link', { name: /read the résumé/i });
    await expect(resumeCta).toBeVisible({ timeout: 15_000 });
    await expect(resumeCta).toHaveAttribute('href', '/resume');
  });

  // ── 2. CTA navigation ────────────────────────────────────────────────────

  test('4 — clicking "View selected work" jumps to the #work section', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    const workCta = page.getByRole('link', { name: /view selected work/i });
    await expect(workCta).toBeVisible({ timeout: 15_000 });
    await workCta.click();
    await expect(page).toHaveURL(/#work$/);
    await expect(page.locator('#work')).toBeVisible();
  });

  test('5 — clicking "Read the résumé" navigates to /resume', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);
    const resumeCta = page.getByRole('link', { name: /read the résumé/i });
    await expect(resumeCta).toBeVisible({ timeout: 15_000 });
    await resumeCta.click();
    await page.waitForURL(`${WEB_URL}/resume`, { timeout: 10_000 });
    expect(page.url()).toContain('/resume');
  });

  // ── 3. SideRail across pages ─────────────────────────────────────────────

  test('6 — SideRail is visible on the home page (/, /blog, /resume)', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const rail = page.locator(RAIL_SELECTOR);
    await expect(rail).toBeVisible({ timeout: 15_000 });

    // Brand link's accessible name comes from aria-label="jcsoftdev — home"
    await expect(rail.getByRole('link', { name: 'jcsoftdev — home' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Writing' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Résumé' })).toBeVisible();
  });

  test('7 — SideRail is visible on /blog', async ({ page }) => {
    await page.goto(`${WEB_URL}/blog`);

    const rail = page.locator(RAIL_SELECTOR);
    await expect(rail).toBeVisible({ timeout: 15_000 });
    await expect(rail.getByRole('link', { name: 'jcsoftdev — home' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Writing' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Résumé' })).toBeVisible();
  });

  test('8 — SideRail is visible on /resume', async ({ page }) => {
    await page.goto(`${WEB_URL}/resume`);

    const rail = page.locator(RAIL_SELECTOR);
    await expect(rail).toBeVisible({ timeout: 15_000 });
    await expect(rail.getByRole('link', { name: 'jcsoftdev — home' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Writing' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Résumé' })).toBeVisible();
  });

  // ── 4. SideRail active-link state ────────────────────────────────────────
  // Only the "routes" array (Writing/Résumé) gets aria-current from the
  // pathname (apps/web/src/lib/active-link.ts) — the in-page "Sections"
  // links (Work/Experience/About) get a scroll-spy `data-active` attribute
  // instead, which these tests don't exercise.

  test('9 — /blog: "Writing" has aria-current="page", "Résumé" does not', async ({ page }) => {
    await page.goto(`${WEB_URL}/blog`);

    const rail = page.locator(RAIL_SELECTOR);
    const writingLink = rail.locator('a[href="/blog"]');
    const resumeLink = rail.locator('a[href="/resume"]');

    await expect(writingLink).toBeVisible({ timeout: 15_000 });
    await expect(writingLink).toHaveAttribute('aria-current', 'page');
    await expect(resumeLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('10 — /resume: "Résumé" has aria-current="page", "Writing" does not', async ({ page }) => {
    await page.goto(`${WEB_URL}/resume`);

    const rail = page.locator(RAIL_SELECTOR);
    const writingLink = rail.locator('a[href="/blog"]');
    const resumeLink = rail.locator('a[href="/resume"]');

    await expect(resumeLink).toBeVisible({ timeout: 15_000 });
    await expect(resumeLink).toHaveAttribute('aria-current', 'page');
    await expect(writingLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('11 — /: neither "Writing" nor "Résumé" has aria-current="page"', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    const rail = page.locator(RAIL_SELECTOR);
    const writingLink = rail.locator('a[href="/blog"]');
    const resumeLink = rail.locator('a[href="/resume"]');

    await expect(writingLink).toBeVisible({ timeout: 15_000 });
    await expect(writingLink).not.toHaveAttribute('aria-current', 'page');
    await expect(resumeLink).not.toHaveAttribute('aria-current', 'page');
  });
});
