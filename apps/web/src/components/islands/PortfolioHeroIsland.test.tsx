/**
 * TDD RED → GREEN — PortfolioHeroIsland tests (Phase 4 / tasks 4.6 → 4.7).
 *
 * Tests:
 * 1. Name line renders "Portfolio" with data-hero-title attribute
 * 2. Role line renders "Selected Work" with data-hero-sub attribute
 * 3. Statement contains "8 years across SaaS, telecom, e-commerce, and government"
 * 4. Primary CTA links to #experience
 * 5. Ghost CTA links to #projects
 * 6. Both CTAs have data-hero-cta attribute
 * 7. Cursor orb (data-cursor-orb) is present
 * 8. createHeroFadeTimeline called on mount
 * 9. createCursorOrbTimeline called on mount
 * 10. fade.kill() + orb.kill() called on unmount (cleanup)
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFadeKill = vi.fn();
const mockOrbKill = vi.fn();
const mockFadeFactory = vi.fn(() => ({ kill: mockFadeKill }));
const mockOrbFactory = vi.fn(() => ({ kill: mockOrbKill }));
const mockInitLenis = vi.fn(() => ({ destroy: vi.fn() }));

vi.mock('@jcsoftdev/animations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@jcsoftdev/animations')>();
  return {
    ...original,
    createHeroFadeTimeline: mockFadeFactory,
    createCursorOrbTimeline: mockOrbFactory,
    initLenis: mockInitLenis,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortfolioHeroIsland — copy and data attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders name heading "Portfolio" with data-hero-title', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    const { container } = render(<PortfolioHeroIsland />);

    const titleEl = container.querySelector('[data-hero-title]');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl?.textContent).toMatch(/portfolio/i);
  });

  it('renders role line "Selected Work" with data-hero-sub', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    const { container } = render(<PortfolioHeroIsland />);

    const subEl = container.querySelector('[data-hero-sub]');
    expect(subEl).toBeInTheDocument();
    expect(subEl?.textContent).toMatch(/selected work/i);
  });

  it('statement contains the 8-years copy', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    render(<PortfolioHeroIsland />);

    expect(screen.getByText(/8 years across/i)).toBeInTheDocument();
  });

  it('primary CTA links to #experience', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    render(<PortfolioHeroIsland />);

    const link = screen.getByRole('link', { name: /experience/i });
    expect(link).toHaveAttribute('href', '#experience');
  });

  it('ghost CTA links to #projects', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    render(<PortfolioHeroIsland />);

    const link = screen.getByRole('link', { name: /projects/i });
    expect(link).toHaveAttribute('href', '#projects');
  });

  it('both CTAs have data-hero-cta attribute', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    const { container } = render(<PortfolioHeroIsland />);

    const ctaLinks = container.querySelectorAll('[data-hero-cta]');
    expect(ctaLinks).toHaveLength(2);
  });

  it('cursor orb (data-cursor-orb) is present', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    const { container } = render(<PortfolioHeroIsland />);

    expect(container.querySelector('[data-cursor-orb]')).toBeInTheDocument();
  });
});

describe('PortfolioHeroIsland — animation lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls createHeroFadeTimeline on mount', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    render(<PortfolioHeroIsland />);

    expect(mockFadeFactory).toHaveBeenCalledTimes(1);
    expect(mockFadeFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls createCursorOrbTimeline on mount', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    render(<PortfolioHeroIsland />);

    expect(mockOrbFactory).toHaveBeenCalledTimes(1);
    expect(mockOrbFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls fade.kill() and orb.kill() on unmount', async () => {
    const { default: PortfolioHeroIsland } = await import('./PortfolioHeroIsland.js');
    const { unmount } = render(<PortfolioHeroIsland />);

    unmount();

    expect(mockFadeKill).toHaveBeenCalledTimes(1);
    expect(mockOrbKill).toHaveBeenCalledTimes(1);
  });
});
