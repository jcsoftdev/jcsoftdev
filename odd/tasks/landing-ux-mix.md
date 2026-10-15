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
- [ ] U4 Chapter meter "01/04" in rail + mobile section anchors in bottom bar (audit #7)
- [ ] U5 Hero WebGL: gate on saveData/low memory/coarse pointer with static fallback; pause when off-screen (audit #4)
- [ ] U6 Raise --color-text-faint contrast in both themes (audit #6)
- [ ] U7 One primary CTA per screen; resume as text link; marquee words become real stack; skip link (audit #5, #8, #11)
- [ ] U8 Checks + visual check (desktop + mobile width)

Route: delegated direct, one writer per task group. Forecast: ~600-800 authored changed lines (above the ~400 delivery budget).
Delivery strategy: single-pr (user: "all in one, doesnt matter"). Writers run sequentially: A = U1-U3, B = U4-U7, then U8.
