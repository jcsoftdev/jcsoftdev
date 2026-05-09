import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for createExperienceFadeUpTimeline (REQ-ANI-1).
 *
 * The exported function must be already wrapped with createReducedMotionSafe.
 * Selector: [data-portfolio-experience-card]
 * Stagger: 0.1s per design §7
 *
 * Note: tests run in node environment (no DOM).
 * We use `{} as Element` as stubs since GSAP is fully mocked.
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

describe('createExperienceFadeUpTimeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
    // Reset to window-less (SSR) state between tests so window manipulation is clean
    delete (globalThis as Record<string, unknown>).window;
  });

  function setupWindow(prefersReducedMotion = false) {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: prefersReducedMotion }),
    };
  }

  // Use minimal Element stub — GSAP is mocked so no real DOM tree needed
  const stubEl = {
    querySelectorAll: vi.fn().mockReturnValue([]),
  } as unknown as Element;

  it('exports createExperienceFadeUpTimeline as a function', async () => {
    setupWindow();
    const mod = await import('./experienceFadeUp.js');
    expect(typeof mod.createExperienceFadeUpTimeline).toBe('function');
  });

  it('returns an object with a .kill() method', async () => {
    setupWindow();
    const { createExperienceFadeUpTimeline } = await import('./experienceFadeUp.js');

    const result = createExperienceFadeUpTimeline(stubEl);

    expect(typeof result.kill).toBe('function');
  });

  it('calling .kill() twice does not throw', async () => {
    setupWindow();
    const { createExperienceFadeUpTimeline } = await import('./experienceFadeUp.js');

    const result = createExperienceFadeUpTimeline(stubEl);

    expect(() => {
      result.kill();
      result.kill();
    }).not.toThrow();
  });

  it('returns no-op timeline when reduced motion is active', async () => {
    setupWindow(true);

    const { createExperienceFadeUpTimeline } = await import('./experienceFadeUp.js');

    const result = createExperienceFadeUpTimeline(stubEl);

    // GSAP timeline should NOT have been created
    expect(gsapMock.timeline).not.toHaveBeenCalled();
    // But kill() must still be callable
    expect(() => result.kill()).not.toThrow();
  });

  it('creates a GSAP timeline when reduced motion is inactive', async () => {
    setupWindow(false);
    const { createExperienceFadeUpTimeline } = await import('./experienceFadeUp.js');

    createExperienceFadeUpTimeline(stubEl);

    expect(gsapMock.timeline).toHaveBeenCalledOnce();
  });

  it('returns no-op timeline in SSR context (no window)', async () => {
    // window deleted in afterEach — start from no-window state
    const { createExperienceFadeUpTimeline } = await import('./experienceFadeUp.js');

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createExperienceFadeUpTimeline(stubEl);
    }).not.toThrow();

    expect(gsapMock.timeline).not.toHaveBeenCalled();
    expect(typeof result?.kill).toBe('function');
  });
});
