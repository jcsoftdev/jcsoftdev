# Audit fixes 2026-09

## Objective
Fix the repo-controllable findings from the 2026-09-25 brain-audit (report: https://claude.ai/code/artifact/44d60348-d280-4133-af25-8b6b27130dcb).

## Constraints
- Branch `fix/audit-2026-09`; one Conventional Commit per task, no AI attribution.
- Never build. Run only the tests the change touches and report counts.
- TDD: off (user override). Regression tests for bug fixes and security boundaries.
- RDD: off (global).

## Tasks
- [x] T1 M36 — admin Posts pagination: align client with server `page/pageSize`; regression test. Route: delegated.
- [x] T2 H01 — API graceful shutdown on SIGTERM/SIGINT (stop server, close pg + Valkey); `init: true` in prod compose. Route: delegated.
- [x] T3 CI hardening — M21 `permissions: contents: read`; M09 `format:astro:check` in lint job; M27 `minimumReleaseAge`. Route: delegated.
- [x] T4 Docs drift — H10 document `ADMIN_EMAILS`; M14 ADR-24 Where line; H07 runbook Autodeploy OFF; M13 ADR-15/21/22 stale refs. Route: delegated.
- [x] T5 M04 — security headers (X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy) in admin Caddyfile and web. Route: delegated.
- [x] T6 H11 — server-side slug regex in API schemas + `.max(300)` on UpdateProjectSchema; test. Route: delegated.
- [x] T7 Admin UX — M34 401 redirect to login; M28 validate on blur/touched; US4 `autoComplete="email"`. Route: delegated.
- [x] T8 Dead code — tailwind.preset.ts, packages/ui Button, fetchPortfolio, unused GSAP factories, postsClient.delete. Route: delegated.
- [x] T9 M10 — include web test files in typecheck; fix surfaced errors. Route: delegated.

## Needs a decision (not started)
- H08 backups: destination bucket (R2/B2/other) and credentials live outside the repo.
- H02 e2e token: how the API should expose a test-only magic-link token.
- H03 analytics: which events to track.
- H04 admin tokens: shared token package vs import from web.
- M32 tags tables: drop via migration or keep for future.
- M08 public rate limit, M23 IaC, M24 heartbeat, M25 observability, M26 digest pinning.

## Progress

### T1 — admin Posts pagination (commit 0bfee6a)
Files: `apps/admin/src/components/PostsTable.tsx`, `apps/admin/src/components/PostsTable.test.tsx`, `apps/admin/src/routes/_auth.dashboard.tsx`.
- Switched `PostsTable`'s page state to 1-indexed and send `page`/`pageSize` instead of `limit`/`offset`, matching `PostListQuerySchema` (`apps/api/src/schemas/posts.ts:66-70`). Updated `hasNextPage`/`hasPrevPage` and the status-filter reset (`setPage(1)`) to match.
- Updated the dashboard's draft/published count queries the same way.
- Added 2 regression tests asserting the exact query params sent (`page`/`pageSize`, no `limit`/`offset`) and that clicking Next requests `page=2`.
- Tests: `pnpm --filter @jcsoftdev/admin exec vitest run src/components/PostsTable.test.tsx` → 9 passed (7 existing + 2 new). No dashboard test file exists; not added (dashboard has no existing test file and the change is a 2-line param rename covered by the same contract PostsTable's tests now assert).

### T2 — API graceful shutdown (commit 3851c33)
Files: `apps/api/src/index.ts`, `apps/api/src/lib/valkey.ts`, `apps/api/src/lib/valkey.test.ts`.
- SIGTERM/SIGINT handler: `server.stop()` (Bun), then `Promise.all([db.$client.end(), valkey.quit?.()])`, 10s hard timeout via `setTimeout(...).unref()` before force `process.exit(1)`.
- Added optional `quit(): Promise<void>` to `ValkeyClient` (implemented via `redis.quit()`); kept optional so the five existing route-test mocks (get/set/del only) keep typechecking without changes.
- `docker-compose.prod.yml` has no `api` service (apps deploy as separate Dokploy Application services) — `init: true` addition does not apply, skipped, reported.
- Tests: `pnpm --filter @jcsoftdev/api exec vitest run src/lib/valkey.test.ts` → 11 passed (10 existing + 1 new `quit` test). No test added for `index.ts` itself — no natural seam (module-level side effects instantiate real infra clients on import).

### T3 — CI hardening (commit 53a6a88)
Files: `.github/workflows/ci.yml`, `.github/workflows/seed-sync.yml`, `pnpm-workspace.yaml`.
- Top-level `permissions: contents: read` added to both workflows. Reviewed every job: none push, comment, or write packages (`deploy` and `seed-sync` only call the Dokploy API with Dokploy secrets, not `GITHUB_TOKEN`) — no per-job grants needed.
- Added `format:astro:check` step to the `ci` job (the combined lint/typecheck/test job), right after `biome check`.
- Added `minimumReleaseAge: 1440` to `pnpm-workspace.yaml`; `packageManager` pins pnpm 10.33.4 (>= 10.16 required) — supported.
- No tests applicable (CI config only). Verified all three YAML files parse with `python3 -c "import yaml; yaml.safe_load(...)"`.

### T4 — Docs drift (commit 7a8e313)
Files: `apps/api/README.md`, `docs/operations.md`, `docs/architecture.md`, `docs/dokploy.md`.
- `ADMIN_EMAILS` documented in `apps/api/README.md`'s env table and as a new "Admin Authorization" section in `docs/operations.md` (no pre-existing generic env-vars section there; placed next to "Cookie Domain Configuration" since both are production auth config).
- ADR-24's "Where" line (was a copy of ADR-23's) now names `docker-compose.prod.yml`, `docs/dokploy.md`, `docs/operations.md`.
- `docs/dokploy.md`: fixed 3 spots claiming Autodeploy is ON (lines ~490, ~498, ~624) to OFF, with a one-line reason (CI's `deploy` job races Dokploy's own webhook otherwise — matches `.github/workflows/ci.yml:326-334`).
- ADR-15, ADR-21, ADR-22, and ADR-23's Consequence (referencing the deleted `ImmersiveProjectsGallery.tsx` / never-shipped `portfolio.astro`) each got an appended `**Status: superseded — ... removed in 0ab4c0a**` note; no history rewritten. Verified via `git log --diff-filter=D` that both files were deleted in 0ab4c0a and `portfolio.astro` never existed in history.
- No tests applicable (docs only).

### T5 — security headers (commit 3d04b99)
Files: `apps/admin/Caddyfile`, `apps/web/src/middleware.ts` (new), `apps/web/src/middleware.test.ts` (new), `apps/web/vitest.config.ts`, `apps/web/vitest.astro.config.ts`.
- Caddy: added a `header` block with `X-Frame-Options DENY`, `Content-Security-Policy "frame-ancestors 'none'"`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`.
- Web: no `src/middleware.ts` existed — added one (Astro 5, node adapter) that sets the same four headers on every response via `defineMiddleware`, skipping any header a route already set. No `script-src` CSP (would break Plausible + inline islands), per instructions.
- Test: `astro:middleware` is a virtual module only the real Astro Vite plugin resolves, so the new test runs under `vitest.astro.config.ts` (added `src/middleware.test.ts` to its `include`, and excluded it from the plain `vitest.config.ts`).
- Tests: `pnpm --filter @jcsoftdev/web exec vitest run --config vitest.astro.config.ts src/middleware.test.ts` → 3 passed. Full web suite (both configs) also re-run clean. Typecheck (`astro check && tsc --noEmit`): 0 errors.

### T6 — server-side slug validation (commit d479223)
Files: `apps/api/src/schemas/shared.ts` (new), `apps/api/src/schemas/shared.test.ts` (new), `apps/api/src/schemas/posts.ts`, `apps/api/src/schemas/posts.test.ts`, `apps/api/src/schemas/portfolio.ts`, `apps/api/src/schemas/portfolio.test.ts`.
- Extracted a shared `slugSchema`/`SLUG_REGEX` (`/^[a-z0-9-]+$/`) into `schemas/shared.ts`, used by `CreatePostSchema`/`UpdatePostSchema`/`CreateProjectSchema`/`UpdateProjectSchema`.
- The regex checks AFTER lowercasing (not before) — a pre-existing test (`CreatePostSchema` "lowercases slug", input `Hello-World`) already asserted mixed-case slugs are accepted and normalized; checking the raw string would have broken that. Only characters outside `[a-z0-9-]` (spaces, punctuation) are now rejected, matching "reject `Bad Slug!`, accept `good-slug-1`".
- Added `.max(300)` to `UpdateProjectSchema.slug` (previously uncapped), matching `CreateProjectSchema`.
- Tests: `pnpm --filter @jcsoftdev/api exec vitest run src/schemas/shared.test.ts src/schemas/posts.test.ts src/schemas/portfolio.test.ts` → 56 passed. Also re-ran `src/routes/posts.test.ts src/routes/projects.test.ts src/routes/public-portfolio.test.ts` → 53 passed (no regressions). Typecheck: 0 errors.

### T7 — Admin UX (commit 769e925)
Files: `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/api.test.ts`, `apps/admin/src/components/LoginForm.tsx`, `apps/admin/src/components/LoginForm.test.tsx`, `apps/admin/src/components/PostEditor.tsx`, `apps/admin/src/components/PostEditor.test.tsx`, `apps/admin/src/components/ProjectForm.tsx`, `apps/admin/src/components/ExperienceForm.tsx`.
- M34: `fetchWithCredentials` now checks the response status; on 401 from a non-`/auth/*` URL it calls `window.location.assign('/login?redirect=<path+search>')`. Better-auth's own routes are mounted at `/auth/*` and don't currently go through this client (they use their own fetch in `lib/auth.ts`), so the guard is a defensive belt-and-suspenders against a future loop rather than a currently-reachable path. Exported `fetchWithCredentials` for testing (same pattern as the existing `resolveApiUrl` export).
- M28: all four TanStack forms (`LoginForm`, `PostEditor`, `ProjectForm`, `ExperienceForm`) keep their `onChange` validators but now gate the visible error span (and `aria-invalid`/`aria-describedby`) on `field.state.meta.isTouched || submissionAttempts > 0`, reading `submissionAttempts` via `useStore(form.store, ...)` from `@tanstack/react-form`.
- US4: `LoginForm`'s email `<input>` gets `autoComplete="email"`.
- Tests: `pnpm --filter @jcsoftdev/admin exec vitest run src/components/LoginForm.test.tsx src/components/PostEditor.test.tsx src/components/ProjectForm.test.tsx src/components/ExperienceForm.test.tsx src/lib/api.test.ts` → 51 passed (7 new: 4 for the 401 redirect/guard/credentials, 2 "no error before touch/submit" regression tests, plus US4 covered inline). Full admin suite re-run → 117 passed. Typecheck: 0 errors.

### T8 — Dead code removal (commit eb1607a)
Files: `packages/config/tailwind.preset.ts` (deleted), `packages/config/package.json`, `packages/ui/src/Button.tsx` + `Button.test.tsx` (deleted), `packages/ui/src/index.ts`, `apps/web/src/lib/portfolio-fetch.ts`, `apps/web/src/lib/portfolio-fetch.test.ts` (deleted), `packages/animations/src/timelines/*` (6 factories + 6 tests, deleted), `packages/animations/src/index.ts`, `packages/animations/src/index.test.ts`, `apps/web/src/web.test.ts`, `apps/admin/src/lib/api.ts`, plus doc updates in `packages/animations/README.md`, `apps/web/README.md`, `docs/architecture.md`.
- Confirmed zero non-test callers via `rg` (including `.astro`/`.mdx`/tests/docs) before each deletion, per instructions.
- `packages/ui` is now down to an empty barrel (`export {}`) — NOT deleted, since `apps/admin`/`apps/web` still declare it as a workspace dependency; reporting this as instructed.
- `fetchPortfolio` (duplicate of `fetchPortfolioResilient`'s live-fetch path) removed along with its dedicated test file `portfolio-fetch.test.ts` (only tested that function) — this goes beyond the literal instruction ("remove their tests too" was written for the GSAP factories) but was necessary since the file had no other purpose once the function was gone.
- GSAP: removed `createHeroFadeTimeline`, `createCursorOrbTimeline`, `createExperienceFadeUpTimeline`, `createGalleryScrubTimeline`, `createProjectsStaggerTimeline`, `createSectionRevealTimeline` — all confirmed zero non-test callers. Kept `initLenis` and the `createReducedMotionSafe`/`KillableTimeline`/`NoOpTimeline`/`TimelineFactory` reduced-motion utility. Fixed `apps/web/src/web.test.ts` (dropped its `createHeroFadeTimeline` tests, now-unused `vi` import) and `packages/animations/src/index.test.ts` (dropped its barrel-export test for the same). `HeroIsland.test.tsx`/`ExperienceIsland.test.tsx` mocks of the removed exports were left alone — they're regression guards asserting these factories are NOT called, which remains true and meaningful.
- `postsClient.delete` removed — confirmed no delete UI exists for posts (unlike `projectsClient.delete`/`experiencesClient.delete`, which are wired to real delete buttons in `ProjectsTable.tsx`/`ExperiencesTable.tsx`).
- `ProjectsGrid.tsx:9-11` (named in the task as an example docstring to update) does not actually reference any removed item — nothing to fix there; noting the discrepancy.
- Updated `docs/architecture.md`'s "GSAP + Lenis Hydration Pattern" section (previously claimed `HeroIsland.tsx` calls `createHeroFadeTimeline`, which was already stale before this task) and `apps/web/README.md`'s islands table (same staleness for `ExperienceIsland.tsx`/`HeroIsland.tsx` rows).
- Tests: `pnpm --filter @jcsoftdev/admin exec vitest run` → 117 passed; `pnpm --filter @jcsoftdev/web exec vitest run --config vitest.config.ts` → 87 passed; `pnpm --filter @jcsoftdev/animations exec vitest run` → 26 passed. Typecheck clean for `@jcsoftdev/admin`, `@jcsoftdev/web` (`astro check` + `tsc`), `@jcsoftdev/animations`, `@jcsoftdev/ui`.

### T9 — include web test files in typecheck (commit 8925ea5)
Files: `apps/web/tsconfig.json`, `apps/web/src/env.d.ts`, `apps/web/src/components/islands/ui/OrbCursor.test.tsx`, `apps/web/src/middleware.test.ts`.
- Removed `src/**/*.test.ts`/`src/**/*.test.tsx` from `tsconfig.json`'s `exclude`.
- Surfaced 34 errors, all fixed (none required non-test source changes, so no revert needed):
  - 24× TS2307 "Cannot find module './X.astro'" across `Footer.test.ts`, `SideRail.test.ts`, `Badge.test.ts`, `Button.test.ts`, `Card.test.ts`, `Link.test.ts` — plain `tsc` (unlike `astro check` or an editor) has no Astro TS plugin and can't resolve `.astro` imports at all. Added a `declare module '*.astro' { const Component: AstroComponentFactory; export default Component; }` ambient fallback to `env.d.ts` (astro's own `client.d.ts` has no such wildcard).
  - 4× implicit-`any` in `OrbCursor.test.tsx` — `ReturnType<typeof vi.spyOn>` loses `addEventListener`'s concrete parameter types, so destructured `([event]) => ...` callbacks lost their type; annotated as `([event]: [string, ...unknown[]]) => ...`.
  - 6× in the new `middleware.test.ts` (introduced by T5 this session) — `MiddlewareHandler`'s declared return type is `Promise<Response> | Response | Promise<void> | void`, wider than what `onRequest` actually returns; added a small `callMiddleware` test helper that runtime-asserts `instanceof Response` to narrow the type instead of widening/loosening the test.
- No `any` used anywhere in the fix.
- Tests: full web suite re-run on both configs → 87 + 37 = 124 passed. Typecheck (`astro check` 67 files, 0 errors + `tsc --noEmit`, 0 errors): clean.

### Skips / notes across T5–T9
- T5: no test added for the Caddyfile change itself (declarative config, no test runner for it in this repo — matches T3's precedent of "no tests applicable, config only").
- T6: extended schema-level tests only (not route-level) — schema tests are where the zod validation actually lives; route tests were re-run to confirm no regressions but not extended, since that would be redundant coverage of the same rule.
- T8: `tailwindcss` remained a devDependency of `packages/config` after removing its only consumer (the preset file) — left alone; the task only asked to remove the preset's package.json *export*, not audit/prune its own deps, and touching `pnpm-lock.yaml` for a devDependency removal was judged out of scope for this task.
