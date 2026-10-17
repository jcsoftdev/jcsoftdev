# blog-display-studio

Objective: improve the whole public posts experience (apps/web `/blog` index and `/blog/[slug]` post) so it matches the landing's monochrome display-studio language and reads well.
Request (user, 2026-10-16): "Mejora toda la parte de posts". Scope assumption: public blog in apps/web only; admin editor and API untouched (no schema/API change).
Route: delegated direct, one sonnet writer (UI, 2+ files). Branch: feat/blog-display-studio (from main 533de12). Delivery: single-pr.
TDD: disabled. Runner: vitest, biome, typecheck, format:astro:check. Never auto-build.

Design source: landing tokens in `apps/web/src/styles/global.css` (`.display-heading`, `.display-numeral`, `.eyebrow-label`, `--ease-reveal`, raised tonal ramp, `[data-reveal]`, SplitHeading, flat grounds, no gradients/glows) and bundle `monochrome-display-studio`.
Constraints: no gradients/glows/shadows; keep SEO + JSON-LD; reduced-motion honoured; dark + light; mobile 390; no new heavy deps; data limited to title/excerpt/date/hero/html.

## Tasks
- [x] B1 Index: display-heading header, editorial list rows (numeral, title, excerpt, date, hover motion), featured latest post, reveal/stagger, empty/error states in the new language, pagination restyled
- [x] B2 Post page: display title, meta line (date + reading time from html), hero, wider/cleaner reading column, refined prose (code blocks, quotes, tables, headings with anchors), scroll progress bar
- [x] B3 Post extras: table of contents from h2/h3 (desktop sticky, hidden on mobile), prev/next or "more writing" footer, share/copy-link
- [x] B4 Checks: vitest for new pure helpers (reading time, TOC extraction), typecheck, biome, format:astro:check; visual dark/light 1440 + 390

## Progress
- 2026-10-16 ac2d862 helpers: reading-time, post-headings (ids + TOC), post-date, with vitest tests.
- 2026-10-16 9f3ab06 B1-B3 UI: blog index, post page, styles/blog.css, scripts/blog-client.ts, SplitHeading `as` prop.
- Checks observed: web tests 165+34 pass, typecheck 0 errors, biome clean, format:astro:check clean.
- B4 done: visual check by parent (Playwright, mock API): index and post, dark 1440 and light 390, no horizontal overflow, title reveal, TOC highlight, more-writing footer OK. Hover/reduced-motion not checked; real API not tried.
- Route: delegated direct, one writer.
