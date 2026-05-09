# Operations Runbook — jcsoftdev

Day-2 operations reference for the jcsoftdev platform. Covers first-run setup, routine maintenance, and production configuration.

---

## MinIO Bucket Bootstrap

Run **once** on a new environment (local dev or production) to provision the `posts-media` bucket with the correct CORS policy.

```bash
# Dry-run (prints steps without executing)
bash infra/minio/bootstrap.sh --dry-run

# Live run
MINIO_ENDPOINT=http://localhost:9000 \
MINIO_ACCESS_KEY=minioadmin \
MINIO_SECRET_KEY=minioadmin \
bash infra/minio/bootstrap.sh
```

The script:
1. Configures an `mc` alias pointing to the MinIO endpoint.
2. Creates the `posts-media` bucket if it does not exist.
3. Applies the CORS policy from `infra/minio/cors.json` (allows PUT/GET/HEAD from admin origin).

**Production note**: set `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` to production values before running. The bucket name defaults to `posts-media` (override with `MINIO_BUCKET_MEDIA` env var).

CORS policy (`infra/minio/cors.json`) allows:
- Origins: `http://localhost:5173` (dev), `https://admin.jcsoftdev.com` (prod)
- Methods: `PUT`, `GET`, `HEAD`
- Headers: `*`
- Expose: `ETag`

---

## First-Run Database Migration

Migrations run against the **direct Postgres URL** (port 5432), bypassing pgBouncer. Never run migrations through pgBouncer (port 6432).

```bash
# Local dev
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/jcsoftdev \
pnpm --filter @jcsoftdev/db db:migrate

# Production (run from VPS or via Dokploy one-shot container)
DATABASE_DIRECT_URL=postgresql://user:pass@localhost:5432/jcsoftdev \
pnpm --filter @jcsoftdev/db db:migrate
```

**CI**: migrations run automatically in the `ci` job before `pnpm turbo test`. See `.github/workflows/ci.yml`.

Migration files are in `packages/db/migrations/`. They are **forward-only** (ADR-9). To roll back: revert the code and write a corrective forward migration.

---

## Seeding the Database

### `seed` — idempotent insert (safe to re-run)

The seed script inserts projects and experiences using `ON CONFLICT DO NOTHING`. Running it multiple times on an already-seeded database inserts zero new rows — existing rows and any admin edits are preserved.

```bash
# Local dev — connect via DATABASE_DIRECT_URL (bypasses pgBouncer)
DATABASE_DIRECT_URL=postgresql://postgres:postgres@localhost:5432/jcsoftdev \
pnpm --filter @jcsoftdev/db seed

# Or with the root .env loaded
pnpm --filter @jcsoftdev/db seed

# Inspect seeded data
pnpm --filter @jcsoftdev/db db:studio
```

### `seed:reset` — TRUNCATE then re-seed (destructive)

`seed:reset` **truncates** `post_tags`, `projects`, `experiences`, and `media` (with `CASCADE`), then runs the normal seed. Use this to restore the database to a known-clean state after manual data experiments.

```bash
# Local dev (requires --confirm flag)
pnpm --filter @jcsoftdev/db seed:reset --confirm
```

**Safety guards** (both must pass):

1. `NODE_ENV` must NOT be `"production"`. If it is, the script exits with code 1 and prints an error.
2. The `--confirm` flag must be present. If absent, the script exits with code 1 and prints instructions.

Both guards are required simultaneously — `--confirm` alone does not override a production NODE_ENV. This is intentional: an accidental `--confirm` in a prod deploy script cannot wipe the database.

> **Production warning**: `seed:reset` is designed for local dev and CI fixture resets only. Never run it against a production database. If you must re-seed production, use the idempotent `seed` script instead.

### CASCADE behavior

`TRUNCATE ... CASCADE` removes child rows in referencing tables automatically. Specifically:
- Rows in `post_tags` referencing `projects` are removed.
- Rows in `media` referencing `projects` or `experiences` are removed.
- The `posts` table is **NOT** truncated — admin-authored blog content is preserved.
- MinIO objects orphaned by a `media` truncation require manual cleanup (follow-up: future media-pipeline reset).

---

## Resend Domain Verification (Production)

1. Log in to [resend.com](https://resend.com).
2. Go to **Domains** → **Add Domain** → enter `jcsoftdev.com`.
3. Add the provided DNS records (SPF, DKIM, DMARC) via your DNS provider (Cloudflare).
4. Wait for verification (usually 5–30 minutes with Cloudflare propagation).
5. Set `RESEND_FROM_EMAIL=noreply@jcsoftdev.com` in the production environment.
6. Test: send a magic-link from the admin login page and confirm delivery.

**Important**: while Resend is in sandbox mode, emails only deliver to the owner's email address. Switch to a verified domain for production use.

---

## Cookie Domain Configuration (Production)

For cross-subdomain cookies (admin SPA on `admin.jcsoftdev.com` calling API on `api.jcsoftdev.com`):

```env
# Production .env
COOKIE_DOMAIN=.jcsoftdev.com
BETTER_AUTH_URL=https://api.jcsoftdev.com
CORS_ORIGINS=https://admin.jcsoftdev.com,https://jcsoftdev.com
NODE_ENV=production
```

The cookie config is driven by these values in `apps/api/src/lib/auth.ts`:
- `prod`: `{ domain: '.jcsoftdev.com', sameSite: 'none', secure: true, httpOnly: true }`
- `dev` (no `COOKIE_DOMAIN`): `{ sameSite: 'lax', secure: false, httpOnly: true }`

**Local dev**: do not set `COOKIE_DOMAIN`. All apps run on `localhost:*` with `SameSite=Lax` and no `Domain` attribute — cookies work across ports on the same host.

---

## API URL Configuration

Both `apps/web` and `apps/admin` resolve the API base URL at runtime via a `resolveApiUrl()` function.

### Environment variable contract

| App | Variable | File |
|---|---|---|
| `apps/web` | `PUBLIC_API_URL` | `apps/web/.env` (copy from `apps/web/.env.example`) |
| `apps/admin` | `VITE_API_URL` | `apps/admin/.env` (copy from `apps/admin/.env.example`) |

Both default to `http://localhost:8787` in development (when the variable is absent).

### Resolution policy (ADR-16)

```
env var set?        → use it (any environment)
env var missing
  └─ PROD=false    → warn + return "http://localhost:8787"
  └─ PROD=true     → throw Error (halts the failing request with a clear message)
```

The throw fires on the **first API call**, not at module load. This prevents a misconfigured production build from crashing the entire SSR bundle — static pages still render; only data-fetching pages fail with an actionable error.

### Port collision warning

Both variables default to port `8787`. If another service in your local environment uses port `8787`, change the API port in the root `.env` AND update both `apps/web/.env` and `apps/admin/.env` to match.

### Production setup

```bash
# apps/web production env
PUBLIC_API_URL=https://api.jcsoftdev.com

# apps/admin production env
VITE_API_URL=https://api.jcsoftdev.com
```

Both variables MUST be set before a production build. Omitting them causes `resolveApiUrl()` to throw at the first API call.

---

## Header Active-Link Convention

`apps/web/src/components/Header.astro` renders a static navigation header using `Astro.url.pathname` for active-link detection. No JavaScript is required.

### How active state works

1. The `isActive(currentPath, linkHref)` helper (at `apps/web/src/lib/active-link.ts`) computes whether a nav link is active:
   - Exact match for root (`/` matches only `/`)
   - Exact or subpath match for other routes (`/portfolio` matches `/portfolio`; `/blog` matches `/blog` and `/blog/*`)
2. When a link is active, `aria-current="page"` is set on its `<a>` element.
3. Tailwind v4's `aria-[current=page]:` variant applies the active style — `font-semibold` + `underline` — entirely via CSS. No JavaScript runs.

### Adding a new nav link

To add a nav link to the header:

1. Extend the `links` array in `apps/web/src/components/Header.astro`:
   ```astro
   const links = [
     { href: '/portfolio', label: 'Portfolio' },
     { href: '/blog', label: 'Blog' },
     { href: '/your-new-route', label: 'New Page' }, // add here
   ];
   ```
2. Add a matching test case to `apps/web/src/lib/active-link.test.ts` covering exact and subpath match for the new route.
3. No JavaScript changes required — the active state derives from `aria-current` and Tailwind CSS.

---

## Rate Limit Settings Reference

Rate limiting uses a **fixed-window** algorithm backed by Valkey.

| Endpoint | Key | Limit | Window |
|---|---|---|---|
| `POST /auth/magic-link/send` | `magic-link:{email}` | 5 requests | 1 hour |

Configuration is in `apps/api/src/app.ts` (wired in the auth handler branch):

```ts
await checkRateLimit(config.valkey, {
  key: `magic-link:${email}`,
  maxRequests: 5,
  windowSeconds: 3600,
});
```

To adjust limits: update the `maxRequests` and `windowSeconds` values and redeploy. No Valkey schema changes required — the key format is `rl:{key}` with TTL = windowSeconds.

---

## Hero Image Public URL Configuration

The public blog route generates hero image URLs using:

```
${MINIO_PUBLIC_URL}/${bucket}/${objectKey}
```

- **Local dev**: `MINIO_PUBLIC_URL=http://localhost:9000` → URLs are `http://localhost:9000/posts-media/posts/...`
- **Production**: `MINIO_PUBLIC_URL=https://minio.jcsoftdev.com` → URLs are `https://minio.jcsoftdev.com/posts-media/posts/...`

If MinIO is behind a proxy (e.g., Traefik), set `MINIO_PUBLIC_URL` to the public-facing domain. The presigned PUT endpoint uses `MINIO_ENDPOINT` (internal network), while the public URL uses `MINIO_PUBLIC_URL` (external network).

---

## Portfolio Cache Invalidation

The public portfolio page is cached in Valkey under the key `public:portfolio:v1` with a 300-second TTL.

### Invalidation flow

```
Admin write (create/update/delete project or experience)
  └─► API handler (projects.ts / experiences.ts)
        └─► DB write succeeds
              └─► invalidatePortfolioCache(valkey) — DEL public:portfolio:v1
                    └─► Next GET /api/v1/public/portfolio → cache MISS
                          └─► Postgres read → serialize → SET public:portfolio:v1
                                └─► Subsequent reads → cache HIT
```

The delete happens AFTER the DB write commits. Valkey and Postgres are not transactional with each other. In the rare case where `DEL` fails (Valkey outage), the stale cache entry expires naturally within 300 seconds — worst-case staleness is one TTL window.

### Manual cache invalidation

To force a cache refresh without making an admin write:

```bash
# Connect to Valkey and delete the key
valkey-cli -u $VALKEY_URL DEL public:portfolio:v1
```

The next portfolio page load repopulates the cache from Postgres.

---

## Reduced-Motion Testing (matchMedia mock pattern)

The `createReducedMotionSafe` HOF and `initLenis` mobile guard both read `window.matchMedia`. In Vitest (jsdom), `matchMedia` is not implemented. Tests must mock it before importing modules that call it at module scope.

Standard mock in test files:

```ts
// In vitest.config.ts setupFiles or the test file itself
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)', // or false for default
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

To test the reduced-motion branch: set `matches: true` for `(prefers-reduced-motion: reduce)`.
To test the touch-device Lenis guard: set `matches: true` for `(pointer: coarse)`.

This pattern is already in `apps/web/src/test-setup.ts`. Use the same approach in any new package that imports from `@jcsoftdev/animations`.

---

## Hard-Delete Consequences for Projects and Experiences

Projects and experiences use **hard delete** (V1 — no soft-delete / archived status).

When an admin calls `DELETE /api/v1/projects/:id` or `DELETE /api/v1/experiences/:id`:
1. The row is permanently removed from Postgres — **no undo**.
2. `hero_media_id` FK is `ON DELETE SET NULL` for media rows — deleting a project does NOT delete the associated media file from MinIO. The media row in Postgres is also preserved. Manual cleanup of orphaned media is required if desired.
3. `invalidatePortfolioCache` is called — the portfolio page reflects the deletion on next load.

**Rollback path**: there is none at the application level. For accidental deletes in production:
1. Restore the row from the most recent Dokploy Postgres backup (`pg_dump`).
2. Re-apply any migrations created after the backup snapshot.
3. Alternatively, recreate the record via the admin UI.

A soft-delete pattern (`archived_at` column + filter in public routes) is deferred to a future change.

---

## Backup Strategy

| Data | Strategy | Notes |
|---|---|---|
| Postgres | pg_dump via Dokploy scheduled backup | Daily, 7-day retention |
| Valkey | Valkey RDB snapshot | Ephemeral data (sessions, cache) — loss is non-critical |
| MinIO | Bucket replication or periodic sync | `mc mirror src/ dst/` for off-site backup |

---

## Design System Overview

The `apps/web` design system (DSI — design-system-immersive) uses Tailwind v4 `@theme` tokens declared in `apps/web/src/styles/global.css`. All tokens are CSS custom properties prefixed with `--color-`, `--text-`, `--font-`, `--spacing-`, `--duration-`, etc.

### Token categories

| Category | Prefix | Example |
|---|---|---|
| Colors (OKLCH) | `--color-*` | `--color-accent: oklch(0.74 0.16 280)` |
| Typography | `--font-*`, `--text-*`, `--leading-*`, `--tracking-*` | `--font-display`, `--text-7xl` |
| Spacing | `--spacing-*`, `--section-y`, `--container-px` | `--spacing-8`, `--section-y` |
| Motion | `--duration-*`, `--ease-*` | `--duration-base`, `--ease-out-expo` |
| Shadows | `--shadow-*` | `--shadow-glow-accent` |
| Radius | `--radius-*` | `--radius-md`, `--radius-full` |
| Z-index | `--z-*` | `--z-header`, `--z-orbs`, `--z-content` |

All component inline styles reference `var(--token)` directly — no hardcoded color values in component files.

### Font preload strategy

Geist Variable (Sans + Mono) are preloaded via `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `RootLayout.astro`. The `href` values come from Vite `?url` imports of the `geist` npm package WOFF2 files.

The same `?url` import is used in the `@font-face` src declaration (injected via `<style set:html>` in the layout). This guarantees the preload URL and the @font-face URL hash-match exactly — the browser reuses the preloaded resource with no duplicate download.

**Do not** move `@font-face` declarations into `global.css` — Vite's CSS pipeline produces different hashed URLs than the Astro layout frontmatter pipeline, breaking the preload optimization.

---

## Lenis Bridge Usage

Lenis smooth scroll can optionally bridge into GSAP's ScrollTrigger via `initLenis({ withScrollTriggerBridge: true })`.

### When to opt-in

Use the bridge when the component uses **both** Lenis smooth scroll AND GSAP ScrollTrigger pin/scrub. Currently: `ImmersiveProjectsGallery.tsx`.

Do NOT use the bridge for components that only use Lenis (e.g., `HeroIsland.tsx` — no ScrollTrigger).

### What the bridge does

1. Calls `ScrollTrigger.scrollerProxy(document.body, { scrollTop, getBoundingClientRect })` — redirects ScrollTrigger's scroll reads through Lenis.
2. Registers `gsap.ticker.add(lenis.raf)` — Lenis drives the rAF loop (no separate `rAF` in lenis.ts when bridge is active).
3. Calls `lenis.on('scroll', ScrollTrigger.update)` — notifies ScrollTrigger on every Lenis scroll tick.
4. Calls `gsap.ticker.lagSmoothing(0)` — prevents GSAP from skipping frames on tab-hidden recovery.

### Gotchas

- **Do not call `lenis.raf` manually** when the bridge is active — GSAP ticker drives it.
- **Cleanup order matters**: call `tl.kill()` before `lenis.destroy()` to avoid ScrollTrigger accessing a destroyed Lenis instance.
- **View Transitions**: register an `astro:before-swap` listener to kill the timeline and destroy Lenis before Astro swaps the DOM. Failing to do so leaks pinned elements across page transitions.
- **Reduced motion + mobile**: the bridge is only initialized in the `full` render branch of `ImmersiveProjectsGallery`. The `reduced` and `mobile` branches use a static grid or CSS scroll-snap respectively — no Lenis, no ScrollTrigger.

---

## Gradient Placeholder Behavior

Project cards and blog post cards use a deterministic CSS conic-gradient as a hero image placeholder when no signed image URL is available from the API.

### How it works

`apps/web/src/lib/gradient-from-slug.ts` exports `gradientFromSlug(slug: string): string`.

1. Computes a polynomial rolling hash of the slug string (`Math.imul` base-31 over char codes).
2. Derives an angle from `hash % 360` — always in `[0, 360)`.
3. Selects two OKLCH stop hues from a fixed violet palette array (`VIOLET_HUES`).
4. Returns a `conic-gradient(from {angle}deg, {stop1}, {stop2})` CSS string.

### Determinism guarantee

Same slug → same gradient, always. This is SSR-safe: the server renders the same gradient the browser would show. No hydration mismatch.

### Future replacement

When the API begins returning signed MinIO GET URLs for `heroImageUrl`, the `<img>` element replaces the gradient placeholder. The container maintains the same aspect ratio (`aspect-[4/5]` for gallery sections), so there is no layout shift on upgrade.

**Do not** add `Math.random()` or `Date.now()` to `gradientFromSlug` — it would break SSR determinism.

---

## Deployment (Dokploy)

See `docs/dokploy.md` for the full Dokploy deployment guide.

Quick reference for re-deploying after a code change:

1. Push to `main` → CI runs lint + typecheck + test + migration gate.
2. If CI passes, Dokploy webhook triggers a redeploy of affected apps.
3. Migration is **not** automatic on deploy — run `db:migrate` manually or via a Dokploy pre-deploy hook before deploying a migration-bearing commit.

**Pre-deploy checklist for migration-bearing commits:**
1. Take a Postgres snapshot (Dokploy backup or `pg_dump`).
2. `DATABASE_DIRECT_URL=... pnpm --filter @jcsoftdev/db db:migrate`
3. Verify migration applied: `pnpm --filter @jcsoftdev/db db:studio`
4. Deploy app (Dokploy redeploy or `git push`).
