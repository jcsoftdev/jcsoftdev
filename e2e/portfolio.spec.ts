/**
 * E2E — portfolio-interactions happy-path + reduced-motion flow
 *
 * Tests the full portfolio content loop:
 *   1. Health check — API reachable
 *   2. Public portfolio endpoint responds with the current payload shape
 *   3. Admin creates a project (hero image upload skipped in CI — no real MinIO)
 *   4. Admin creates an experience
 *   5. Home page (`/`) renders both portfolio sections
 *   6. Semantic structure of the experience list / project rows
 *   7. Reduced-motion variant — reveal items are visible via the CSS fallback
 *
 * The portfolio moved off a dedicated /portfolio route onto the home page
 * (apps/web/src/pages/index.astro): "Selected work" is #work,
 * "Experience" is #experience. The public API's combined payload shape also
 * changed from flat arrays to `{ projects: { items: [] }, experiences: { items: [] } }`
 * (apps/api/src/routes/public-portfolio.ts).
 *
 * The project card grid was replaced by a read-out table
 * (apps/web/src/components/islands/ProjectsGrid.tsx): rows are `<li><a>` or
 * `<li><div>`, not `<article>`, they carry no `data-portfolio-project-card`
 * hook any more, and they render no hero image — a gradient monogram chip
 * replaced it. The experience list (ExperienceIsland.tsx) still marks its
 * rows with `data-portfolio-experience-card`, but as `<li>`, not `<article>`.
 * See the final report for exact locations — this is a genuine UI change,
 * not something these specs should paper over.
 *
 * GSAP is no longer used anywhere on this page — reveal-on-scroll is plain
 * CSS + IntersectionObserver (index.astro), guarded by a
 * `prefers-reduced-motion: reduce` media query. There is no more
 * NoOpTimeline to probe; the reduced-motion test below checks that CSS
 * fallback directly.
 *
 * Prerequisites (all must be running):
 *   - API   → http://localhost:3000
 *   - Admin → http://localhost:5173
 *   - Web   → http://localhost:4321
 *   - Postgres 17, Valkey 8 (via docker compose or CI services)
 *
 * These specs are dev-only and NOT blocking in CI (continue-on-error: true in e2e job).
 * Run with: pnpm exec playwright test e2e/portfolio.spec.ts
 *
 * Auth strategy: mirrors core-platform.spec.ts — TEST_MAGIC_LINK_TOKEN env var
 * or falls back to skipping auth-dependent tests gracefully.
 */

import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:5173';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:4321';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@jcsoftdev.com';

// Deterministic slugs / identifiers for E2E created content
const E2E_PROJECT_NAME = 'E2E Portfolio Test Project';
const E2E_PROJECT_SLUG = 'e2e-portfolio-test-project';
const E2E_PROJECT_SUMMARY = 'A project created by Playwright E2E for portfolio testing.';
const E2E_PROJECT_DESC = '## About\n\nThis project demonstrates the portfolio loop.';

const E2E_EXPERIENCE_COMPANY = 'E2E Test Corp';
const E2E_EXPERIENCE_ROLE = 'Software Engineer (E2E)';
const E2E_EXPERIENCE_SUMMARY = 'Work experience created by Playwright E2E for portfolio testing.';

// ---------------------------------------------------------------------------
// Helper: get magic-link token (mirrors core-platform.spec.ts pattern)
// ---------------------------------------------------------------------------

async function getMagicLinkToken(apiUrl: string, email: string): Promise<string | null> {
  if (process.env.TEST_MAGIC_LINK_TOKEN) {
    return process.env.TEST_MAGIC_LINK_TOKEN;
  }

  // better-auth's magicLink plugin mounts the send endpoint at
  // POST /sign-in/magic-link, not /magic-link/send.
  const sendRes = await fetch(`${apiUrl}/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, callbackURL: '/dashboard' }),
  });

  if (!sendRes.ok) {
    console.error('Magic-link send failed:', sendRes.status, await sendRes.text());
    return null;
  }

  // This API has no test-mode token exposure — TEST_MAGIC_LINK_TOKEN is the
  // only way to drive the authenticated tests below.
  const body = (await sendRes.json().catch(() => null)) as {
    testToken?: string;
  } | null;
  return body?.testToken ?? null;
}

// ---------------------------------------------------------------------------
// Helper: authenticate via magic-link (sets session cookie on page)
// ---------------------------------------------------------------------------

async function authenticateWithMagicLink(
  page: import('@playwright/test').Page,
  apiUrl: string,
  adminUrl: string,
  email: string
): Promise<boolean> {
  const token = await getMagicLinkToken(apiUrl, email);

  if (!token) {
    test.skip(true, 'Magic-link token not available — configure TEST_MAGIC_LINK_TOKEN');
    return false;
  }

  await page.goto(`${apiUrl}/auth/magic-link/verify?token=${token}`, {
    waitUntil: 'networkidle',
  });

  // The admin SPA's "/" route is a public landing page (apps/admin/src/routes/index.tsx)
  // — it never redirects an authenticated session anywhere on its own. Go
  // straight to the guarded route instead of waiting for a redirect that
  // does not happen.
  await page.goto(`${adminUrl}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  return true;
}

// ---------------------------------------------------------------------------
// Helper: create a project via admin UI (returns true on success)
// ---------------------------------------------------------------------------

async function createProject(
  page: import('@playwright/test').Page,
  adminUrl: string
): Promise<boolean> {
  await page.goto(`${adminUrl}/projects/new`);
  await expect(page.locator('form')).toBeVisible({ timeout: 10_000 });

  // slug/name/summary are required by CreateProjectSchema
  // (apps/api/src/schemas/portfolio.ts); description is optional but filled
  // here to exercise the markdown preview pane.
  await page.getByRole('textbox', { name: 'Slug' }).fill(E2E_PROJECT_SLUG);
  await page.getByRole('textbox', { name: 'Name' }).fill(E2E_PROJECT_NAME);
  await page.getByRole('textbox', { name: 'Summary' }).fill(E2E_PROJECT_SUMMARY);
  await page.getByRole('textbox', { name: 'Description' }).fill(E2E_PROJECT_DESC);

  // Hero image upload is skipped in CI (no real MinIO with test buckets initialized)
  // heroMediaId is optional — omitting it is a valid create path

  await page.getByRole('button', { name: /save/i }).click();

  // onSaved navigates straight to the projects list, never to an edit page
  // (apps/admin/src/routes/_auth.projects.new.tsx).
  const redirected = await page
    .waitForURL(/\/projects$/, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  return redirected;
}

// ---------------------------------------------------------------------------
// Helper: create an experience via admin UI
// ---------------------------------------------------------------------------

async function createExperience(
  page: import('@playwright/test').Page,
  adminUrl: string
): Promise<boolean> {
  await page.goto(`${adminUrl}/experiences/new`);
  await expect(page.locator('form')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('textbox', { name: 'Company' }).fill(E2E_EXPERIENCE_COMPANY);
  await page.getByRole('textbox', { name: 'Role' }).fill(E2E_EXPERIENCE_ROLE);
  await page.getByRole('textbox', { name: 'Summary' }).fill(E2E_EXPERIENCE_SUMMARY);

  // Both required by CreateExperienceSchema (apps/api/src/schemas/portfolio.ts)
  // — startedAt and displayOrder are non-optional server-side, and
  // ExperienceForm's own client-side validator blocks submission until
  // Display Order is filled too. The original test filled neither.
  await page.getByLabel('Started At').fill('2024-01-01');
  await page.getByLabel('Display Order').fill('99');

  await page.getByRole('button', { name: /save/i }).click();

  const redirected = await page
    .waitForURL(/\/experiences$/, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  return redirected;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('portfolio-interactions E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 1. Baseline ──────────────────────────────────────────────────────────

  test('1 — health check: API is reachable', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  test('2 — public portfolio endpoint responds with the current payload shape', async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/api/v1/public/portfolio`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      projects: { items: unknown[] };
      experiences: { items: unknown[] };
    };
    expect(Array.isArray(body.projects.items)).toBeTruthy();
    expect(Array.isArray(body.experiences.items)).toBeTruthy();
  });

  // ── 2. Admin create content ───────────────────────────────────────────────

  test('3 — authenticated admin can navigate to the projects list', async ({ page }) => {
    const authed = await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);
    if (!authed) return;

    await page.goto(`${ADMIN_URL}/projects`);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('4 — admin can create a project (no hero image)', async ({ page }) => {
    const authed = await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);
    if (!authed) return;

    const created = await createProject(page, ADMIN_URL);
    expect(created).toBeTruthy();
  });

  test('5 — admin can create an experience', async ({ page }) => {
    const authed = await authenticateWithMagicLink(page, API_URL, ADMIN_URL, ADMIN_EMAIL);
    if (!authed) return;

    const created = await createExperience(page, ADMIN_URL);
    expect(created).toBeTruthy();
  });

  // ── 3. Public home page ────────────────────────────────────────────────────

  test('6 — / renders the hero and both portfolio sections', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    // Hero
    await expect(page.getByRole('heading', { name: /juan carlos valencia/i })).toBeVisible({
      timeout: 15_000,
    });

    // Selected work — #work
    await expect(page.locator('#work')).toBeVisible({ timeout: 15_000 });

    // Experience — #experience
    await expect(page.locator('#experience')).toBeVisible({ timeout: 15_000 });
  });

  test('7 — experience renders as a semantic list; project rows render', async ({ page }) => {
    await page.goto(`${WEB_URL}/`);

    // Scroll down to trigger client:visible hydration for both islands
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1_000);

    // Experience rows still carry a stable data hook and are <li> elements
    // (ExperienceIsland.tsx renders an <ol> of <li data-portfolio-experience-card>,
    // not <article> cards).
    const expCards = page.locator('[data-portfolio-experience-card]');
    const expCount = await expCards.count();
    expect(expCount).toBeGreaterThan(0);
    const expTag = await expCards.first().evaluate((el) => el.tagName.toLowerCase());
    expect(expTag).toBe('li');

    // ProjectsGrid no longer exposes a data hook — it renders a plain <ul> of
    // <li> rows under #work. Assert on that structure instead.
    const projectRows = page.locator('#work ul > li');
    expect(await projectRows.count()).toBeGreaterThan(0);
  });

  // ── 4. Reduced-motion variant ─────────────────────────────────────────────

  test('8 — reduced-motion: reveal items are visible via the CSS fallback', async ({ browser }) => {
    // GSAP is no longer used on this page at all (confirmed: no import of
    // @jcsoftdev/animations' timelines anywhere under apps/web/src — only
    // `initLenis`, a smooth-scroll helper, is used, in HeroIsland.tsx).
    // Reveal-on-scroll is a plain IntersectionObserver + CSS transition
    // (index.astro), and it is guarded by a `prefers-reduced-motion: reduce`
    // media query that sets opacity:1/transform:none/transition:none
    // unconditionally — no scroll or intersection needed to observe it.
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto(`${WEB_URL}/`);

    const item = page.locator('[data-reveal-item]').first();
    await expect(item).toBeVisible({ timeout: 10_000 });

    const style = await item.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { opacity: cs.opacity, transform: cs.transform };
    });

    expect(Number.parseFloat(style.opacity)).toBeGreaterThanOrEqual(0.99);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(style.transform);

    await context.close();
  });
});
