/**
 * TDD RED → GREEN — ImmersiveProjectsGallery component tests (Phase 6 / tasks 6.6 → 6.7).
 *
 * Tests:
 *  RENDER BRANCHES (matchMedia mock)
 * 1.  Full branch: renders gallery sections when desktop + fine-pointer + motion OK
 * 2.  Reduced-motion branch: renders static card grid (no ScrollTrigger sections)
 * 3.  Mobile branch (coarse pointer): renders scroll-snap layout
 *
 *  CONTENT
 * 4.  Each project section renders the project name
 * 5.  Each project section renders the project summary
 * 6.  Each project section renders a gradient placeholder (data-gradient-placeholder attr)
 * 7.  8 project sections render when 8 projects passed (full branch)
 * 8.  Project cards in reduced-motion branch carry data-portfolio-project-card attribute
 *
 *  LIFECYCLE
 * 9.  Lenis bridge initialized (initLenis({ withScrollTriggerBridge: true })) in full branch
 * 10. createGalleryScrubTimeline called on mount in full branch
 * 11. kill() called on unmount in full branch
 * 12. lenis.destroy() called on unmount in full branch
 *
 *  VIEW TRANSITIONS
 * 13. astro:before-swap listener registered on mount (full branch)
 * 14. astro:before-swap listener removed on unmount
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

// ---------------------------------------------------------------------------
// Mocks — animations
// ---------------------------------------------------------------------------

const mockGalleryKill = vi.fn();
const mockGalleryScrubFactory = vi.fn(() => ({ kill: mockGalleryKill }));
const mockLenisDestroy = vi.fn();
const mockInitLenis = vi.fn(() => ({ destroy: mockLenisDestroy }));

vi.mock('@jcsoftdev/animations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@jcsoftdev/animations')>();
  return {
    ...original,
    initLenis: mockInitLenis,
    createGalleryScrubTimeline: mockGalleryScrubFactory,
  };
});

// ---------------------------------------------------------------------------
// matchMedia helpers
// ---------------------------------------------------------------------------

type MediaState = {
  prefersReducedMotion: boolean;
  pointerCoarse: boolean;
};

function mockMatchMedia({ prefersReducedMotion, pointerCoarse }: MediaState) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: prefersReducedMotion
        ? query.includes('prefers-reduced-motion')
        : pointerCoarse
          ? query.includes('pointer: coarse') || query.includes('pointer:coarse')
          : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<PublicProject> = {}): PublicProject {
  const i = Math.floor(Math.random() * 1000);
  return {
    id: `proj-${i}`,
    slug: `project-${i}`,
    name: `Project ${i}`,
    summary: `Summary for project ${i}`,
    descriptionHtml: null,
    repoUrl: `https://github.com/user/project-${i}`,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2022-01-01',
    endedAt: '2023-06-01',
    heroImageUrl: null,
    ...overrides,
  };
}

function makeProjects(count: number): PublicProject[] {
  return Array.from({ length: count }, (_, i) =>
    makeProject({
      id: `proj-${i}`,
      slug: `project-${i}`,
      name: `Project ${i}`,
      summary: `Summary ${i}`,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImmersiveProjectsGallery — full branch (desktop, fine pointer, motion OK)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia({ prefersReducedMotion: false, pointerCoarse: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders gallery root with project sections in full mode', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(3);

    render(<ImmersiveProjectsGallery projects={projects} />);

    // data-gallery-root present
    const galleryRoot = document.querySelector('[data-gallery-root]');
    expect(galleryRoot).toBeTruthy();
  });

  it('renders 8 project sections when 8 projects passed', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(8);

    render(<ImmersiveProjectsGallery projects={projects} />);

    const sections = document.querySelectorAll('[data-gallery-section]');
    expect(sections.length).toBe(8);
  });

  it('renders project name in each section', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = [makeProject({ name: 'My Awesome Project', slug: 'my-awesome-project' })];

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(screen.getByText('My Awesome Project')).toBeTruthy();
  });

  it('renders project summary in each section', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = [makeProject({ summary: 'An incredible summary text', slug: 'test' })];

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(screen.getByText('An incredible summary text')).toBeTruthy();
  });

  it('renders gradient placeholder for each project section', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    const placeholders = document.querySelectorAll('[data-gradient-placeholder]');
    expect(placeholders.length).toBe(2);
  });

  it('initializes Lenis with withScrollTriggerBridge: true in full mode', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(mockInitLenis).toHaveBeenCalledWith({ withScrollTriggerBridge: true });
  });

  it('calls createGalleryScrubTimeline on mount in full mode', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(mockGalleryScrubFactory).toHaveBeenCalledOnce();
  });

  it('calls kill() and lenis.destroy() on unmount', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    const { unmount } = render(<ImmersiveProjectsGallery projects={projects} />);
    unmount();

    expect(mockGalleryKill).toHaveBeenCalledOnce();
    expect(mockLenisDestroy).toHaveBeenCalledOnce();
  });

  it('registers astro:before-swap listener on mount', async () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    const swapCalls = addEventListenerSpy.mock.calls.filter((c) => c[0] === 'astro:before-swap');
    expect(swapCalls.length).toBeGreaterThan(0);

    addEventListenerSpy.mockRestore();
  });

  it('removes astro:before-swap listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    const { unmount } = render(<ImmersiveProjectsGallery projects={projects} />);
    unmount();

    const swapCalls = removeEventListenerSpy.mock.calls.filter((c) => c[0] === 'astro:before-swap');
    expect(swapCalls.length).toBeGreaterThan(0);

    removeEventListenerSpy.mockRestore();
  });
});

describe('ImmersiveProjectsGallery — reduced-motion branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia({ prefersReducedMotion: true, pointerCoarse: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders static card grid (no gallery sections) when reduced-motion is active', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(4);

    render(<ImmersiveProjectsGallery projects={projects} />);

    // No pinned sections
    const sections = document.querySelectorAll('[data-gallery-section]');
    expect(sections.length).toBe(0);
  });

  it('renders all projects as static cards in reduced-motion mode', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(4);

    render(<ImmersiveProjectsGallery projects={projects} />);

    // Cards visible (data-portfolio-project-card)
    const cards = document.querySelectorAll('[data-portfolio-project-card]');
    expect(cards.length).toBe(4);
  });

  it('does NOT call initLenis in reduced-motion branch', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(mockInitLenis).not.toHaveBeenCalled();
  });

  it('does NOT call createGalleryScrubTimeline in reduced-motion branch', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(mockGalleryScrubFactory).not.toHaveBeenCalled();
  });
});

describe('ImmersiveProjectsGallery — mobile branch (coarse pointer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia({ prefersReducedMotion: false, pointerCoarse: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders scroll-snap container when pointer is coarse', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(3);

    render(<ImmersiveProjectsGallery projects={projects} />);

    // No pinned gallery sections
    const pinned = document.querySelectorAll('[data-gallery-section]');
    expect(pinned.length).toBe(0);

    // Scroll-snap container present
    const snapContainer = document.querySelector('[data-scroll-snap-gallery]');
    expect(snapContainer).toBeTruthy();
  });

  it('renders all projects in mobile scroll-snap mode', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(3);

    render(<ImmersiveProjectsGallery projects={projects} />);

    const cards = document.querySelectorAll('[data-portfolio-project-card]');
    expect(cards.length).toBe(3);
  });

  it('does NOT call initLenis in mobile branch (ADR-12)', async () => {
    const { ImmersiveProjectsGallery } = await import('./ImmersiveProjectsGallery.js');
    const projects = makeProjects(2);

    render(<ImmersiveProjectsGallery projects={projects} />);

    expect(mockInitLenis).not.toHaveBeenCalled();
  });
});
