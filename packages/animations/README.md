# @jcsoftdev/animations

GSAP + Lenis animation utilities for the jcsoftdev platform. SSR-safe, reduced-motion-aware.

## Overview

All exports are SSR-safe. Animation factories return a no-op when:
- Running in a server context (`typeof window === 'undefined'`)
- The user prefers reduced motion (`prefers-reduced-motion: reduce`)

Lenis is disabled on touch-primary devices (`pointer: coarse` media query).

## Exports

### `initLenis(opts?)`

Initialize Lenis smooth scroll. Returns `Lenis | null`.

Returns `null` when:
- SSR (no `window`)
- `window.matchMedia('(pointer: coarse)').matches` — touch-primary device (ADR-12)

```ts
import { initLenis } from '@jcsoftdev/animations';

const lenis = initLenis();
// Always null-check before using:
lenis?.destroy();
```

### `createReducedMotionSafe(factory)`

Higher-order function (HOF) that wraps any GSAP timeline factory. Returns a new function with the same signature that returns a `NoOpTimeline` when the user prefers reduced motion or when running in SSR (ADR-11).

```ts
import { createReducedMotionSafe } from '@jcsoftdev/animations';
import { myCustomTimeline } from './my-timeline';

export const safeTimeline = createReducedMotionSafe(myCustomTimeline);
```

The `NoOpTimeline` has a single `kill()` no-op method — safe to call without branching.

**V1 behavior**: reduced-motion preference is read once at island mount (static, not reactive to mid-session changes).

### `createHeroFadeTimeline(root)`

Pre-wrapped (via `createReducedMotionSafe`) hero fade timeline.

- Selectors: `[data-hero-title]`, `[data-hero-sub]`
- Used by: `HeroIsland.tsx`, `PortfolioHeroIsland.tsx`

### `createExperienceFadeUpTimeline(root)`

Pre-wrapped experience cards fade-up timeline.

- Selector: `[data-portfolio-experience-card]`
- Behavior: ScrollTrigger stagger (`start: 'top 85%'`); per-card stagger 0.1s; y: 30→0, opacity: 0→1, duration 0.5s
- Used by: `ExperienceIsland.tsx`

### `createProjectsStaggerTimeline(root)`

Pre-wrapped project cards stagger timeline.

- Selector: `[data-portfolio-project-card]`
- Behavior: ScrollTrigger stagger; stagger 0.08s; y: 40→0, opacity: 0→1, duration 0.6s
- Used by: `ProjectsIsland.tsx` (legacy)

### `createCursorOrbTimeline(orbElement)`

Pre-wrapped cursor-tracking orb timeline.

- Attaches a `pointermove` listener to `document`; drives a `translate3d` transform on `orbElement` via a rAF lerp loop (factor 0.08).
- Guards: returns `NoOpTimeline` on `pointer: coarse` (touch-primary), SSR, or reduced motion.
- Returns `{ kill() }` — removes the event listener and cancels the rAF on cleanup.
- Used by: `HeroIsland.tsx`, `PortfolioHeroIsland.tsx`

```ts
import { createCursorOrbTimeline } from '@jcsoftdev/animations';

const orb = createCursorOrbTimeline(orbRef.current!);
// On unmount:
orb.kill();
```

### `createGalleryScrubTimeline(root)`

Pre-wrapped GSAP ScrollTrigger pinned gallery timeline.

- Queries all `[data-gallery-section]` elements inside `root`.
- Per section: creates a GSAP timeline with `scrollTrigger: { pin: true, scrub: 1, start: 'top top', end: '+=100%' }`.
- Outgoing fade: `gsap.to(section, { opacity: 0, scale: 0.95 })` at 70% progress.
- Last section gets `pinSpacing: true`.
- Returns `{ kill() }` — kills all ScrollTrigger instances on cleanup.
- Used by: `ImmersiveProjectsGallery.tsx` (full-mode branch only)

```ts
import { createGalleryScrubTimeline } from '@jcsoftdev/animations';

const tl = createGalleryScrubTimeline(galleryRootRef.current!);
// On unmount:
tl.kill();
```

## Mandatory pattern for new factories

1. Create the factory in `src/timelines/yourFactory.ts`.
2. Import and wrap it in `src/index.ts` via `createReducedMotionSafe` before re-exporting.
3. Consumers MUST import from the package barrel, never from internal paths.

```ts
// src/index.ts pattern
import { createReducedMotionSafe } from './reduced-motion.js';
import { createYourTimeline as _createYourTimeline } from './timelines/yourFactory.js';

export const createYourTimeline = createReducedMotionSafe(_createYourTimeline);
```

## Testing

```bash
pnpm --filter @jcsoftdev/animations test
```

Tests mock `window.matchMedia` via `Object.defineProperty`. See `src/reduced-motion.test.ts` and `src/lenis.test.ts` for patterns.

## Lenis mobile guard — testing pattern

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)', // simulate touch device
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
