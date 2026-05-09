import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests that the hero fade factory exported from index.ts is already
 * wrapped with createReducedMotionSafe (REQ-ANI-3 / task 2.5).
 *
 * Also tests (Phase 4 / task 4.3) that the raw factory includes a tween
 * for [data-hero-cta] in addition to [data-hero-title] and [data-hero-sub].
 */

// Mock GSAP to avoid DOM/browser dependency
const mockTimeline = {
  kill: vi.fn(),
  from: vi.fn().mockReturnThis(),
};

const gsapMock = {
  timeline: vi.fn().mockReturnValue(mockTimeline),
  registerPlugin: vi.fn(),
};

vi.mock('gsap', () => ({
  default: gsapMock,
  gsap: gsapMock,
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { name: 'ScrollTrigger' },
}));

describe('createHeroFadeTimeline (reduced-motion-safe via index)', () => {
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
    querySelector: vi.fn().mockReturnValue(null),
    querySelectorAll: vi.fn().mockReturnValue([]),
  } as unknown as Element;

  it('exports createHeroFadeTimeline from barrel index', async () => {
    setupWindow();
    const mod = await import('../index.js');
    expect(typeof mod.createHeroFadeTimeline).toBe('function');
  });

  it('returns no-op when reduced motion is active (wrapped)', async () => {
    setupWindow(true);
    const { createHeroFadeTimeline } = await import('../index.js');

    const result = createHeroFadeTimeline(stubEl);

    // GSAP timeline must NOT have been created
    expect(gsapMock.timeline).not.toHaveBeenCalled();
    // kill() must still work
    expect(() => result.kill()).not.toThrow();
  });

  it('creates real timeline when reduced motion is inactive', async () => {
    setupWindow(false);
    const { createHeroFadeTimeline } = await import('../index.js');

    createHeroFadeTimeline(stubEl);

    expect(gsapMock.timeline).toHaveBeenCalledOnce();
  });

  it('returns no-op in SSR context (no window)', async () => {
    const { createHeroFadeTimeline } = await import('../index.js');

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createHeroFadeTimeline(stubEl);
    }).not.toThrow();

    expect(gsapMock.timeline).not.toHaveBeenCalled();
    expect(typeof result?.kill).toBe('function');
  });

  it('also exports createExperienceFadeUpTimeline and createProjectsStaggerTimeline', async () => {
    setupWindow();
    const mod = await import('../index.js');
    expect(typeof mod.createExperienceFadeUpTimeline).toBe('function');
    expect(typeof mod.createProjectsStaggerTimeline).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — CTA tween tests (raw factory, not reduced-motion-wrapped)
// Tests the raw createHeroFadeTimeline from heroFade.ts directly so we can
// assert on tl.from() calls without the reduced-motion guard short-circuiting.
// ---------------------------------------------------------------------------

describe('createHeroFadeTimeline raw factory — CTA tween (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeStubEl(elements: Partial<Record<string, HTMLElement | null>> = {}): Element {
    return {
      querySelector: vi.fn((selector: string) => elements[selector] ?? null),
    } as unknown as Element;
  }

  it('calls tl.from with an element matching [data-hero-cta] when present', async () => {
    const stubCta = { tagName: 'DIV' } as unknown as HTMLElement;
    const el = makeStubEl({
      '[data-hero-title]': null,
      '[data-hero-sub]': null,
      '[data-hero-cta]': stubCta,
    });

    const { createHeroFadeTimeline } = await import('./heroFade.js');
    createHeroFadeTimeline(el);

    const fromCalls = mockTimeline.from.mock.calls;
    const ctaCall = fromCalls.find((args) => args[0] === stubCta);
    expect(ctaCall).toBeDefined();
  });

  it('title and sub tweens still present when all elements exist (regression guard)', async () => {
    const stubTitle = { tagName: 'H1' } as unknown as HTMLElement;
    const stubSub = { tagName: 'P' } as unknown as HTMLElement;
    const stubCta = { tagName: 'DIV' } as unknown as HTMLElement;

    const el = makeStubEl({
      '[data-hero-title]': stubTitle,
      '[data-hero-sub]': stubSub,
      '[data-hero-cta]': stubCta,
    });

    const { createHeroFadeTimeline } = await import('./heroFade.js');
    createHeroFadeTimeline(el);

    const fromCalls = mockTimeline.from.mock.calls;
    const titleCall = fromCalls.find((args) => args[0] === stubTitle);
    const subCall = fromCalls.find((args) => args[0] === stubSub);
    const ctaCall = fromCalls.find((args) => args[0] === stubCta);

    expect(titleCall).toBeDefined();
    expect(subCall).toBeDefined();
    expect(ctaCall).toBeDefined();
    // Three tweens total — no extra tweens added
    expect(fromCalls).toHaveLength(3);
  });

  it('skips CTA tween when [data-hero-cta] element is absent (no null-tween)', async () => {
    const el = makeStubEl({
      '[data-hero-title]': null,
      '[data-hero-sub]': null,
      '[data-hero-cta]': null,
    });

    const { createHeroFadeTimeline } = await import('./heroFade.js');
    createHeroFadeTimeline(el);

    // No tl.from() calls because all selectors returned null
    expect(mockTimeline.from).not.toHaveBeenCalled();
  });
});
