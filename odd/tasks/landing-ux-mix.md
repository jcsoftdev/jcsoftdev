# landing-ux-mix

Objective: improve the UX of the home landing (apps/web) by mixing jcsoftdev-design-prompts bundles per `references/mixing.md`.
Base (owns tokens, type, easing, gutter, reveal grammar, scroll model, signature): the current site system with the display typography from `landing-display-studio`. Grafts (layout only): `chaptered-product-film` chapter meter; `chat-proof-landing` step row ("How I work") ; `monochrome-display-studio` featured-card + hairline ideas. Pinned tracks/lists rejected: they break the triggered-not-scrubbed model.
Source: subagent UX audit (12 ranked findings) on branch feat/landing-display-studio.

Constraints: no invented metrics or client names (only facts already in resume.data.ts / portfolio data); reduced-motion fallbacks; keyboard + contrast; keep SEO/JSON-LD; generated code in English.
TDD: disabled. Runner: vitest (`pnpm --filter @jcsoftdev/web test`), biome lint, typecheck, `pnpm format:astro:check`. Tests for logic only (e.g. data mappers, gating helper).

## Tasks
- [x] U1 Project rows expand inline (problem/result + stack chips), year/type, larger top-3, dead rows handled (audit #1, #9)
- [x] U2 Experience: show top 2 bullets + stack, collapse the rest, older roles collapsed (audit #3)
- [x] U3 Proof strip under hero CTAs from real data + "How I work" 3-step row in About (audit #2, #12)
- [x] U4 Chapter meter "01/04" in rail + mobile section anchors in bottom bar (audit #7)
- [x] U5 Hero WebGL: gate on saveData/low memory/coarse pointer with static fallback; pause when off-screen (audit #4)
- [x] U6 Raise --color-text-faint contrast in both themes (audit #6)
- [x] U7 One primary CTA per screen; resume as text link; marquee words become real stack; skip link (audit #5, #8, #11)
- [x] U8 Checks (typecheck 0 errors, lint clean, vitest 112 + 34 passed, format ok) + visual check at 1440px and 390px, light scheme (Playwright). Dark scheme not checked. Fixed mobile bottom-bar contrast (opaque bar).

Route: delegated direct, one writer per task group. Forecast: ~600-800 authored changed lines (above the ~400 delivery budget).
Delivery strategy: single-pr (user: "all in one, doesnt matter"). Writers run sequentially: A = U1-U3, B = U4-U7, then U8.

## Follow-up (user feedback 2026-10-15: "no mejoró la UX, el fondo no se ve bien, gradientes muy slop")
Verified in dark scheme: 64px .measure-grid over the whole <main>, blue radial glow orb in Contact (blur 80), blue radial poster gradient in HeroIsland fallback, accent-blue featured project titles, accent corner ticks on panel-frame.
- [x] U9 Flat grounds: remove measure-grid backdrop and decorative gradients/orbs (keep the hero scrim that guards legibility), alternate section grounds with surface tokens + hairlines, neutral project titles (accent only on hover/focus/marker), drop panel-frame ticks. Visual re-check in dark and light at 1440 and 390. Visual check dark 1440/390 done; light not re-checked after this pass. Monogram chips flattened too.

## Follow-up 2 (user: "esos cuadros no hacen buen contraste, falta darle vida, motions etc")
- [x] U10 Contrast: boxes (project rows, role rows, By-the-numbers panel, reading card, link rows, chips) clearly separate from the ground in dark and light, calm, no gradients/glows.
- [x] U11 Motion/life (transform+opacity only, one easing, reduced-motion safe, no new dependency, no pinned/scrubbed scroll): heading mask reveals, staggered row reveals, hover/press feedback on boxes, count-up numbers, experience timeline line that draws, marquee pause on hover. Visual check dark+light 1440 done (no stuck items after natural scroll); hover and 390px not re-checked.

U10/U11 implemented; checks passed (typecheck 0 errors, lint clean, vitest 121 + 34, format ok). Visual check (dark + light, 1440/390, hover/reduced-motion) stays with the parent.
