# @jcsoftdev/web

Public-facing site and blog built with Astro 5, React 19 islands, and Tailwind v4.

## Development

```bash
# From repo root
pnpm --filter @jcsoftdev/web dev

# Or directly
cd apps/web && pnpm dev
```

Site starts on `http://localhost:4321`.

## Architecture

- **Output mode**: SSR (`output: 'server'`) with Node adapter (standalone)
- **Islands**: React components with `client:load` / `client:visible` directives
- **Transitions**: Astro View Transitions via `<ClientRouter />`
- **Speculation Rules**: Prerendering for all non-admin routes
- **Styling**: Tailwind v4 via `@tailwindcss/vite` plugin
- **Animations**: GSAP + Lenis via `@jcsoftdev/animations` (loaded in React islands only)

## Pages

| Path | Mode | Description |
|---|---|---|
| `/` | SSR | Home / landing page with hero island |
| `/blog` | SSR | Public blog list |
| `/blog/[slug]` | SSR | Individual blog post (MDX rendered) |
| `/portfolio` | SSR | Portfolio page — projects + work experience |

## Islands (React components with hydration)

| Island | Directive | Description |
|---|---|---|
| `HeroIsland.tsx` | `client:load` | Home hero section with GSAP fade + Lenis scroll |
| `PortfolioHeroIsland.tsx` | `client:load` | Portfolio hero with portfolio-specific copy and anchor links |
| `ExperienceIsland.tsx` | `client:visible` | Work experience cards; `createExperienceFadeUpTimeline` on mount |
| `ImmersiveProjectsGallery.tsx` | `client:visible` | Full-screen pinned gallery (desktop), static grid (reduced-motion), scroll-snap (mobile); Lenis + ScrollTrigger bridge |
| `ProjectsIsland.tsx` | `client:visible` | Legacy project cards (kept for reference; superseded by ImmersiveProjectsGallery) |

Islands use `client:load` (above-fold) or `client:visible` (below-fold, intersection observer) per ADR-15. All animation factories are pre-wrapped with `createReducedMotionSafe` — no GSAP timelines start when `prefers-reduced-motion: reduce` is set.

## UI Component Library (`src/components/ui/`)

Atomic design system components. All use CSS custom property tokens from `global.css` via inline `var(--token)` references. No hardcoded colors.

| Component | Description |
|---|---|
| `Badge.astro` | Pill-shaped label; variants: `solid`, `ghost`, `accent`; sizes: `sm`, `md`; font-mono |
| `Button.astro` | CTA element; renders `<a>` when `href` is set, `<button>` otherwise; variants: `primary`, `ghost`, `link`; sizes: `md`, `lg` |
| `Card.astro` | Surface container with border and radius; optional `hover` prop (lift + glow on hover) |
| `Container.astro` | Max-width wrapper (`--container-max`) with auto inline margins |
| `ErrorCard.astro` | Alert card with danger border, warning icon, title + message + optional retryHint/retryHref |
| `Heading.astro` | Semantic heading (h1–h6) with `display`, `h1`, `h2`, `h3` visual variants; Geist Sans display font |
| `Link.astro` | Smart link; auto-detects external URLs and adds `target="_blank" rel="noopener noreferrer"` + external icon |
| `Mono.astro` | Inline `<span>` in Geist Mono; optional `accent` color prop |
| `NoiseTexture.astro` | Fixed SVG feTurbulence noise overlay (decorative, `mix-blend-mode: overlay`, `opacity: 0.04`) |
| `OrbBackground.astro` | Radial violet gradient orb; positions: `top-right`, `top-left`, `center`, `bottom-right`, `bottom-left` |
| `Section.astro` | Semantic `<section>` with `padding-block: var(--section-y)`; optional `numbered` prop + named `header` slot |
| `SectionHeader.astro` | Zero-padded section number + eyebrow label + heading; used with `Section numbered` |
| `Text.astro` | Body text `<p>`; variants: `body`, `lead`, `muted`, `eyebrow` |

## Testing

```bash
pnpm --filter @jcsoftdev/web test
```

## Build

```bash
pnpm --filter @jcsoftdev/web build
# Output: apps/web/dist/ (Node standalone server)
```

## Docker

Build from repo root:

```bash
docker build -f apps/web/Dockerfile -t jcsoftdev-web .
docker run -p 4321:4321 -e PUBLIC_API_URL=http://localhost:3000 jcsoftdev-web
```

## Environment Variables

| Variable | Description |
|---|---|
| `PUBLIC_API_URL` | URL of the API server (exposed to browser) |
| `PORT` | HTTP port (default: 4321) |
| `HOST` | Bind address (default: 0.0.0.0) |
