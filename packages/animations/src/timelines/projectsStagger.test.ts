import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for createProjectsStaggerTimeline (REQ-ANI-2).
 *
 * The exported function must be already wrapped with createReducedMotionSafe.
 * Selector: [data-portfolio-project-card]
 * Stagger: 0.08s per design §7
 */

// Mock GSAP to avoid DOM/browser dependency
const mockTimeline = {
  kill: vi.fn(),
  from: vi.fn().mockReturnThis(),
  to: vi.fn().mockReturnThis(),
};

const gsapMock = {
  timeline: vi.fn().mockReturnValue(mockTimeline),
  registerPlugin: vi.fn(),
  utils: {
    toArray: vi.fn().mockReturnValue([]),
  },
};

vi.mock('gsap', () => ({
  default: gsapMock,
  gsap: gsapMock,
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { name: 'ScrollTrigger' },
}));

describe('createProjectsStaggerTimeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).window;
  });

  function setupWindow(prefersReducedMotion = false) {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: prefersReducedMotion }),
    };
  }

  const stubEl = {
    querySelectorAll: vi.fn().mockReturnValue([]),
  } as unknown as Element;

  it('exports createProjectsStaggerTimeline as a function', async () => {
    setupWindow();
    const mod = await import('./projectsStagger.js');
    expect(typeof mod.createProjectsStaggerTimeline).toBe('function');
  });

  it('returns an object with a .kill() method', async () => {
    setupWindow();
    const { createProjectsStaggerTimeline } = await import('./projectsStagger.js');

    const result = createProjectsStaggerTimeline(stubEl);

    expect(typeof result.kill).toBe('function');
  });

  it('calling .kill() twice does not throw', async () => {
    setupWindow();
    const { createProjectsStaggerTimeline } = await import('./projectsStagger.js');

    const result = createProjectsStaggerTimeline(stubEl);

    expect(() => {
      result.kill();
      result.kill();
    }).not.toThrow();
  });

  it('returns no-op timeline when reduced motion is active', async () => {
    setupWindow(true);

    const { createProjectsStaggerTimeline } = await import('./projectsStagger.js');

    const result = createProjectsStaggerTimeline(stubEl);

    expect(gsapMock.timeline).not.toHaveBeenCalled();
    expect(() => result.kill()).not.toThrow();
  });

  it('creates a GSAP timeline when reduced motion is inactive', async () => {
    setupWindow(false);
    const { createProjectsStaggerTimeline } = await import('./projectsStagger.js');

    createProjectsStaggerTimeline(stubEl);

    expect(gsapMock.timeline).toHaveBeenCalledOnce();
  });

  it('returns no-op timeline in SSR context (no window)', async () => {
    const { createProjectsStaggerTimeline } = await import('./projectsStagger.js');

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createProjectsStaggerTimeline(stubEl);
    }).not.toThrow();

    expect(gsapMock.timeline).not.toHaveBeenCalled();
    expect(typeof result?.kill).toBe('function');
  });
});
