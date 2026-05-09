/**
 * TDD RED → GREEN — HeroIsland tests (Phase 4 / tasks 4.4 → 4.5).
 *
 * Original tests (pre-Phase 4 / existing):
 * 1. Primary CTA rendered as <a> with href="/portfolio"
 * 2. Secondary CTA rendered as <a> with href="/blog"
 * 3. Both CTAs carry the data-hero-cta attribute
 * 4. Animation factory called on mount
 * 5. timeline.kill() called on unmount (cleanup regression guard)
 *
 * Phase 4 extensions:
 * 6. Renders name line with data-hero-title attribute
 * 7. Renders role line with data-hero-sub attribute
 * 8. Name line contains "Juan Carlos Valencia"
 * 9. Role line contains "Senior Full-Stack Architect"
 * 10. Statement line contains "Building clean, fast, purposeful software."
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

  it('renders primary CTA as an <a> element linking to /portfolio', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    const link = screen.getByRole('link', { name: /view portfolio/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/portfolio');
  });

  it('renders secondary CTA as an <a> element linking to /blog', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    const link = screen.getByRole('link', { name: /read blog/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/blog');
  });

  it('both CTAs have data-hero-cta attribute', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    const ctaLinks = container.querySelectorAll('a[data-hero-cta]');
    expect(ctaLinks).toHaveLength(2);
  });

  it('calls createHeroFadeTimeline on mount', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(mockTimelineFactory).toHaveBeenCalledTimes(1);
    expect(mockTimelineFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls timeline.kill() on unmount', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { unmount } = render(<HeroIsland />);

    unmount();

    expect(mockKill).toHaveBeenCalledTimes(1);
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

  it('role line contains "Senior Full-Stack Architect"', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(screen.getByText(/senior full-stack architect/i)).toBeInTheDocument();
  });

  it('statement line contains "Building clean, fast, purposeful software."', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(screen.getByText(/building clean, fast, purposeful software/i)).toBeInTheDocument();
  });

  it('OrbCursor is mounted (data-cursor-orb element present)', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { container } = render(<HeroIsland />);

    expect(container.querySelector('[data-cursor-orb]')).toBeInTheDocument();
  });

  it('calls createCursorOrbTimeline on mount', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    render(<HeroIsland />);

    expect(mockCursorOrbFactory).toHaveBeenCalledTimes(1);
    expect(mockCursorOrbFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls cursorOrb.kill() on unmount', async () => {
    const { default: HeroIsland } = await import('./HeroIsland.js');
    const { unmount } = render(<HeroIsland />);

    unmount();

    expect(mockOrbKill).toHaveBeenCalledTimes(1);
  });
});
