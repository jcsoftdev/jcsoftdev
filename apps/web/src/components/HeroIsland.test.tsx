/**
 * TDD RED → GREEN — HeroIsland tests (Phase 4 / tasks 4.4 → 4.5).
 *
 * NOTE: the primary CTA used to link to /portfolio and the copy used to read
 * "Senior Full-Stack Architect". The /portfolio page was removed (the home page
 * is now a single scroller whose nav deep-links to section ids) and the role
 * line was reworded, but these assertions were never updated.
 *
 * Original tests (pre-Phase 4 / existing):
 * 1. Primary CTA rendered as <a> with href="#work"
 * 2. Secondary CTA rendered as <a> with href="/blog"
 * 3. Both CTAs carry the data-hero-cta attribute
 * 4. Animation factory called on mount
 * 5. timeline.kill() called on unmount (cleanup regression guard)
 *
 * Phase 4 extensions:
 * 6. Renders name line with data-hero-title attribute
 * 7. Renders role line with data-hero-sub attribute
 * 8. Name line contains "Juan Carlos Valencia"
 * 9. Role line contains "Senior Full-Stack Developer"
 * 10. Statement line contains the positioning sentence
 * 11. <OrbCursor> is mounted in the hero (data-cursor-orb element present)
 * 12. createCursorOrbTimeline called on mount
 * 13. cursorOrb.kill() called on unmount (cleanup regression guard)
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — animations factory (keep lenis + createHeroFadeTimeline isolated)
// ---------------------------------------------------------------------------

const mockKill = vi.fn();
const mockOrbKill = vi.fn();
const mockTimelineFactory = vi.fn(() => ({ kill: mockKill }));
const mockCursorOrbFactory = vi.fn(() => ({ kill: mockOrbKill }));
const mockInitLenis = vi.fn(() => ({ destroy: vi.fn() }));

vi.mock('@jcsoftdev/animations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@jcsoftdev/animations')>();
  return {
    ...original,
    createHeroFadeTimeline: mockTimelineFactory,
    createCursorOrbTimeline: mockCursorOrbFactory,
    initLenis: mockInitLenis,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeroIsland — CTAs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders primary CTA as an <a> element linking to the #work section', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    const link = screen.getByRole('link', { name: /view selected work/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    // /portfolio no longer exists — the home page scrolls to #work instead.
    expect(link).toHaveAttribute('href', '#work');
  });

  // The rail carries a permanent Writing link, so the hero's second CTA is no
  // longer the only way to reach the blog. It points at the résumé instead —
  // the second click a recruiter actually looks for.
  it('renders secondary CTA as an <a> element linking to /resume', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    const link = screen.getByRole('link', { name: /read the r\u00e9sum\u00e9/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/resume');
  });

  it('both CTAs have data-hero-cta attribute', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    const ctaLinks = container.querySelectorAll('a[data-hero-cta]');
    expect(ctaLinks).toHaveLength(2);
  });

  // The hero owns a single entrance timeline now. createHeroFadeTimeline drove
  // the same title/sub/cta nodes off a ScrollTrigger that reversed on scroll-up
  // — correct for a full-viewport hero, but with two timelines writing the same
  // opacity the copy rendered invisible. This guards against it coming back.
  it('does not use the scroll-triggered hero fade timeline', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(mockTimelineFactory).not.toHaveBeenCalled();
  });

  it('unmounts cleanly with no scroll-triggered timeline to tear down', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { unmount } = render(<HeroIsland />);

    expect(() => unmount()).not.toThrow();
    expect(mockKill).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — copy + data attributes + OrbCursor + cursor-orb factory
// ---------------------------------------------------------------------------

describe('HeroIsland — Phase 4 copy and composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders an element with data-hero-title', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    expect(container.querySelector('[data-hero-title]')).toBeInTheDocument();
  });

  it('renders an element with data-hero-sub', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    expect(container.querySelector('[data-hero-sub]')).toBeInTheDocument();
  });

  it('name line contains "Juan Carlos Valencia"', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(screen.getByRole('heading', { name: /juan carlos valencia/i })).toBeInTheDocument();
  });

  it('role line contains "Senior Full-Stack Developer"', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    expect(screen.getByText(/senior full-stack developer/i)).toBeInTheDocument();
    // The role line is the [data-hero-sub] element, not just any text node.
    expect(container.querySelector('[data-hero-sub]')?.textContent).toMatch(
      /senior full-stack developer/i
    );
  });

  it('statement line contains the positioning sentence', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(screen.getByText(/i build software that doesn't fight you/i)).toBeInTheDocument();
  });

  // The cursor orb was a device for a full-bleed backdrop: it lit the area of
  // planet the pointer was over. In the rail layout the planet lives in its own
  // bordered panel, so the orb had nothing to light and it also overrode the
  // pointer affordance. These tests now guard its removal.
  it('does not mount a cursor orb', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    expect(container.querySelector('[data-cursor-orb]')).toBeNull();
    expect(mockCursorOrbFactory).not.toHaveBeenCalled();
  });

  it('unmounts cleanly with no cursor-orb timeline to tear down', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { unmount } = render(<HeroIsland />);

    expect(() => unmount()).not.toThrow();
    expect(mockOrbKill).not.toHaveBeenCalled();
  });

  // The planet is the hero's backdrop, behind the copy — the signature's
  // chromatic halo and the dark text shadows only make sense over it. A short
  // detour boxed the mesh into a side panel; this guards against that.
  it('renders the planet as a full-bleed backdrop behind the copy', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    // No side panel — the mesh is not boxed next to the copy.
    expect(container.querySelector('aside.panel-frame')).toBeNull();

    // Type over a bright planet needs the scrim to stay legible.
    const scrim = container.querySelector('[data-hero-scrim]');
    expect(scrim).toBeInTheDocument();

    // The copy must paint above both the mesh layer and the scrim.
    const title = container.querySelector('[data-hero-title]');
    expect(title?.closest('.z-10')).toBeInTheDocument();
  });
});
