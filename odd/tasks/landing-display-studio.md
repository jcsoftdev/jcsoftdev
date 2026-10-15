# landing-display-studio

Objective: apply the `monochrome-display-studio` bundle (typography + rhythm pass only, option 1) to the home landing in apps/web.
Bundle: ~/.claude/skills/jcsoftdev-design-prompts/references/monochrome-display-studio/ (read index.md, then only needed files).

Scope (authorized): apps/web/src/pages/index.astro, apps/web/src/styles/global.css, RootLayout font wiring, small new components. Keep: side rail, hero/WebGL, Geist body, blue accent, data fetching, SEO.
Out of scope: sticky cream showcase, process stage, skills console, perf-tier hook, light-mode rework.

Constraints: reduced-motion fallbacks required; no brand/copy from the source; Tailwind v4 tokens in @theme; no drop shadows; hairline borders.
TDD: disabled (implement, then tests where they buy safety). Runner: vitest (`pnpm --filter @jcsoftdev/web test`), lint biome, `format:astro:check`.

## Tasks
- [x] T1 Display face (condensed caps, self-hosted) wired in RootLayout + @theme token `--font-condensed`
- [x] T2 Section headings + eyebrows `( LABEL )` restyle in index.astro (work, experience, about, contact)
- [x] T3 Marquee band component between sections (CSS keyframes, reduced-motion safe)
- [~] T4 Hairline lattice / stats bar polish for about + projects; grayscale-to-color images (stats readout in display face done; images skipped: ProjectsGrid renders none)
- [x] T5 Contact heading per-letter reveal (reduced-motion safe)
- [x] T6 Checks + visual check at 1440px, light scheme (dev server, Playwright). Dark scheme not checked.

Route: delegated direct (one writer; 2+ non-trivial files). Delivery: ask-on-risk.
Progress: branch created.
