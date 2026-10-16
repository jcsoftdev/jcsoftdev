# landing-performance

Objective: substantially improve the performance of the home landing (apps/web, Astro 5 SSR + React islands + Three.js hero) without changing its look or behaviour.
Request (user, 2026-10-15): "necesitamos mejorar un monton el performance, hazlo con opus".
Route: delegated direct, one opus worker (root causes unknown -> deep tier). Branch: perf/landing-performance (from main bc155d4).

Constraints: measure before and after on a production build (build allowed for this task; output stays gitignored); no visual or copy regressions (dark + light); keep reduced-motion, a11y and SEO/JSON-LD; no new heavy dependencies; every claimed win needs a before/after number; revert anything that does not measurably help.
TDD: disabled. Runner: vitest, biome, typecheck, format:astro:check.

## Tasks (the worker refines after the baseline)
- [x] P1 Baseline: production build, bundle/chunk sizes, transfer sizes per route, Lighthouse/Playwright metrics (LCP, TBT/INP proxy, CLS, JS bytes, requests) desktop + mobile profile, TTFB of the SSR page
- [x] P2 Diagnose top costs (candidates: Three.js ~720KB hero chunk and when it loads, HeroMesh size/cost, GSAP/Lenis/React island hydration, fonts, SSR data fetch on every request, render-blocking CSS, LCP element)
- [x] P3 Fix in order of measured impact, one commit per coherent win
- [x] P4 After numbers + regression check (tests, visual dark/light 1440/390)

## P1 Baseline (2026-10-15, main bc155d4 build, API down -> fallback snapshot)

Setup: `pnpm --filter @jcsoftdev/web build`, `node dist/server/entry.mjs` on 127.0.0.1:4327, Playwright Chromium, cache disabled, median of 3 runs.
Desktop = 1440x900, 40ms RTT, 10 Mbps, CPU 1x. Mobile = 390x844 touch (coarse pointer, so the WebGL gate shows the poster), 150ms RTT, 1.6 Mbps, CPU 4x.

| Metric | Desktop | Mobile |
| --- | --- | --- |
| TTFB (curl, local) | 14 ms | 14 ms |
| FCP | 532 ms | 1796 ms |
| LCP (SignatureName char) | 912 ms | 2184 ms |
| CLS | 0 | 0.0001 |
| TBT (long tasks after FCP) | 349 ms (2 tasks, 449 ms) | 0 ms (1 task, 120 ms) |
| Requests | 18 | 13 |
| Transfer total | 1401 KB | 701 KB |
| JS | 1051 KB | 351 KB |
| CSS | 50 KB | 50 KB |
| Fonts | 151 KB | 151 KB |
| HTML | 148 KB | 148 KB |

Chunks (raw / gzip): HeroMesh 709 / 206 KB, client (React DOM) 187 / 59, HeroIsland 146 / 55 (contains gsap + ScrollTrigger + Lenis via the animations barrel), ClientRouter 15 / 5, ExperienceIsland 7 / 2.4, ProjectsGrid 6 / 2, CSS 50 / ~9.

Findings: production (jcsoftdev.com, checked with curl) serves HTML and every `/_astro` asset with NO Content-Encoding (HTML 109 KB, client.js 186 KB raw); `@astrojs/node` standalone never compresses. Render-blocking cross-origin Google Fonts stylesheet for Caveat, which no element uses. HeroIsland pulls gsap + ScrollTrigger only to call `initLenis`. Portfolio fetch has no timeout.

## P2 Ranked costs (measured)

1. No compression anywhere in production (HTML 151 KB, JS ~1 MB raw on desktop) - biggest transfer cost, worst on mobile.
2. Font bytes: Geist + Geist Mono ~140 KB for glyphs never rendered; Bebas preloaded although not in the first viewport.
3. HeroIsland chunk 146 KB raw, ~80% gsap + ScrollTrigger pulled in by the animations barrel just for Lenis.
4. Render-blocking third-party Caveat stylesheet (unused font).
5. Portfolio API fetch without timeout: a hanging API hangs the page (>20 s measured).
6. Desktop WebGL scene build: one 250-500 ms long task (Canvas2D 2048 textures, 40k-vertex terrain, shader link). Terrain hashing was the top JS hotspot per frame.
7. Magnetic CTA rAF loop ticking forever (small).

## P3 Work units (route: inline, single worker; each re-measured)

| Commit | Change | Evidence |
| --- | --- | --- |
| a23ad9f | brotli/gzip SSR HTML (middleware) + precompressed /_astro (server.mjs, scripts/precompress.mjs) | mobile transfer 701 -> 289 KB, LCP 2184 -> 1404 ms |
| 1f2a64d | drop unused Caveat Google Fonts stylesheet | desktop DCL 464 -> 250 ms, LCP 888 -> 740 ms, -1 request |
| 9d40bc3 | gsap-free `@jcsoftdev/animations/smooth-scroll` for the hero | HeroIsland 146 -> 30 KB raw; mobile JS 107 -> 68 KB, FCP 1296 -> 1128 ms |
| 3f595cb | Latin subsets of Geist/Geist Mono preloaded, full files as range-limited fallbacks; no Bebas preload | fonts 151 -> 81 KB; mobile LCP 1408 -> 1272 ms |
| 638ddc2 | memoised terrain cell hashes (bit-identical, golden test) | 40,962 vertices 172 -> 45 ms (node); per-frame terrain self time 540 -> 300 ms / 3 s |
| 71b9199 | 2 s API timeout + 15 s failure back-off | hanging API: TTFB >20 s -> 2.0 s first visitor, ~15 ms after |
| 1c78e9f | Magnetic loop sleeps when settled | idle script 10 -> 6 ms / 3 s |

Tried and reverted: `renderer.compileAsync` before starting the hero loop (5-run A/B: TBT 399 vs 405 ms, long tasks 584 vs 563 ms - no gain).

## P4 Final (same setup as baseline, median of 3; API down -> fallback snapshot)

| Metric | Desktop before | Desktop after | Mobile before | Mobile after |
| --- | --- | --- | --- | --- |
| FCP | 532 ms | 232 ms (runs ranged 232-512) | 1796 ms | 1260 ms |
| LCP | 912 ms | 600 ms | 2184 ms | 1440 ms |
| CLS | 0 | 0 | 0.0001 | 0.0001 |
| TBT | 349 ms | 188 ms (noisy: 188-444 across runs, not claimed) | 0 ms | 33 ms |
| Requests | 18 | 15 | 13 | 12 |
| Transfer | 1401 KB | 348 KB | 701 KB | 178 KB |
| JS | 1051 KB | 238 KB | 351 KB | 68 KB |
| CSS | 50 KB | 9 KB | 50 KB | 9 KB |
| Fonts | 151 KB | 81 KB | 151 KB | 81 KB |
| HTML | 148 KB | 20 KB | 148 KB | 20 KB |

Checks: web typecheck 0 errors (astro check 60 files + tsc); web lint clean (74 files); web tests 22 files / 149 tests + astro 6 files / 34 tests; animations tests 11 files / 75 tests; format:astro:check clean.
Visual (Playwright, dark + light, 1440 + 390): 28/28 reveal items visible after natural scrolling, WebGL canvas renders at 1440, Lenis active on desktop, no console errors; hero/work/experience/about/contact screenshots reviewed.

Deploy note: production must run `node ./server.mjs` (Dockerfile CMD and `start` updated) and build with `pnpm build` (now runs precompress).

## Remaining (not done)

- Desktop hero scene build is still one 250-500 ms long task (Canvas2D 2048 px textures, geometry, shader link). Splitting setup across frames or moving texture baking to a worker could cut TBT by ~200-400 ms on desktop; large refactor of HeroMesh.tsx.
- HeroMesh chunk is 709 KB raw / 206 KB gzip (full `three` namespace + 6 postprocessing passes); named imports alone will not shrink it much.
- HTML is still 151 KB raw (class-heavy markup, island props); compressed to 20 KB, so low priority.
