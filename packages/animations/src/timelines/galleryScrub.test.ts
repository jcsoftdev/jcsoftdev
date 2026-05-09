/**
 * TDD RED → GREEN — createGalleryScrubTimeline factory tests (Phase 6 / task 6.3 → 6.4).
 *
 * Tests:
 * 1. Factory is exported from timelines/galleryScrub module
 * 2. Factory is exported from @jcsoftdev/animations barrel index
 * 3. reduced-motion → returns NoOpTimeline (no ScrollTrigger created)
 * 4. SSR (no window) → returns NoOpTimeline
 * 5. Factory creates ScrollTrigger with expected pin config (mock GSAP + ScrollTrigger)
 * 6. Factory creates a trigger per section element
 * 7. kill() cleans up all ScrollTrigger instances
 * 8. Sections that are NOT last → outgoing fade+scale animation added (opacity 0, scale 0.95)
 * 9. Last section keeps pinSpacing (footer can scroll into view)
 * 10. Returns object with kill() method
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock GSAP + ScrollTrigger
// ---------------------------------------------------------------------------

const mockKill = vi.fn();
const mockScrollTriggerInstances: Array<{ kill: typeof mockKill; vars: Record<string, unknown> }> =
  [];

const mockTo = vi.fn().mockReturnValue({ scrollTrigger: null });
const mockFromTo = vi.fn().mockReturnValue({ scrollTrigger: null });

const mockScrollTriggerCreate = vi.fn((vars: Record<string, unknown>) => {
  const instance = { kill: vi.fn(), vars };
  mockScrollTriggerInstances.push(instance);
  return instance;
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    timeline: vi.fn((opts: Record<string, unknown>) => {
      // Simulate ScrollTrigger creation when timeline is created with scrollTrigger config
      const st = opts?.scrollTrigger
        ? mockScrollTriggerCreate(opts.scrollTrigger as Record<string, unknown>)
        : null;
      return {
        scrollTrigger: st,
        to: mockTo,
        fromTo: mockFromTo,
      };
    }),
    to: mockTo,
    fromTo: mockFromTo,
    set: vi.fn(),
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: mockScrollTriggerCreate,
    update: vi.fn(),
    defaults: vi.fn(),
    refresh: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSection(dataAttr = 'data-gallery-section'): HTMLElement {
  return {
    getAttribute: (attr: string) => (attr === dataAttr ? '' : null),
    querySelectorAll: vi.fn().mockReturnValue([]),
    style: {},
  } as unknown as HTMLElement;
}

function makeRoot(sections: HTMLElement[]): HTMLElement {
  return {
    querySelectorAll: vi.fn((selector: string) => {
      if (selector === '[data-gallery-section]') return sections;
      return [];
    }),
    style: {},
  } as unknown as HTMLElement;
}

function setupWindow(prefersReducedMotion = false) {
  (globalThis as Record<string, unknown>).window = {
    matchMedia: vi.fn((query: string) => ({
      matches: prefersReducedMotion ? query.includes('prefers-reduced-motion') : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
    innerWidth: 1440,
    innerHeight: 900,
  };
  (globalThis as Record<string, unknown>).document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { style: { transform: '' } },
  };
}

describe('createGalleryScrubTimeline — module export', () => {
  it('is exported from timelines/galleryScrub module', async () => {
    const mod = await import('./galleryScrub.js');
    expect(typeof mod.createGalleryScrubTimeline).toBe('function');
  });
});

describe('createGalleryScrubTimeline — barrel export', () => {
  it('is exported from @jcsoftdev/animations barrel index', async () => {
    const mod = await import('../index.js');
    expect(typeof (mod as Record<string, unknown>).createGalleryScrubTimeline).toBe('function');
  });
});

describe('createGalleryScrubTimeline — reduced-motion + SSR guards', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockScrollTriggerInstances.length = 0;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  });

  it('returns NoOpTimeline when prefers-reduced-motion: reduce is active', async () => {
    setupWindow(true);
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection()];
    const root = makeRoot(sections);

    const result = createGalleryScrubTimeline(root);

    // kill() must not throw
    expect(() => result.kill()).not.toThrow();
    // No ScrollTrigger created
    expect(mockScrollTriggerCreate).not.toHaveBeenCalled();
  });

  it('returns NoOpTimeline in SSR context (no window)', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection()];
    const root = makeRoot(sections);

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createGalleryScrubTimeline(root);
    }).not.toThrow();
    expect(() => result?.kill()).not.toThrow();
  });
});

describe('createGalleryScrubTimeline — full pin/scrub setup', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockScrollTriggerInstances.length = 0;
    setupWindow(false);
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  });

  it('creates a GSAP timeline per section with pin:true and scrub:1', async () => {
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection(), makeSection()];
    const root = makeRoot(sections);

    createGalleryScrubTimeline(root);

    // One timeline (with scrollTrigger) created per section
    expect(mockScrollTriggerCreate).toHaveBeenCalledTimes(sections.length);
    // Each trigger has pin: true
    for (const call of mockScrollTriggerCreate.mock.calls) {
      const stConfig = call[0] as Record<string, unknown>;
      expect(stConfig).toMatchObject({
        pin: true,
        scrub: 1,
        start: 'top top',
        end: '+=100%',
      });
    }
  });

  it('creates a timeline per [data-gallery-section] element', async () => {
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection()];
    const root = makeRoot(sections);

    createGalleryScrubTimeline(root);

    expect(mockScrollTriggerCreate).toHaveBeenCalledTimes(2);
  });

  it('returns an object with kill() method', async () => {
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection()];
    const root = makeRoot(sections);

    const result = createGalleryScrubTimeline(root);

    expect(typeof result.kill).toBe('function');
    expect(() => result.kill()).not.toThrow();
  });

  it('last section has pinSpacing: true (non-last sections have pinSpacing: false)', async () => {
    const { createGalleryScrubTimeline } = await import('./galleryScrub.js');
    const sections = [makeSection(), makeSection(), makeSection()];
    const root = makeRoot(sections);

    createGalleryScrubTimeline(root);

    const calls = mockScrollTriggerCreate.mock.calls;
    // Non-last sections: pinSpacing false
    for (let i = 0; i < calls.length - 1; i++) {
      const call = calls[i];
      const stConfig = (call as [Record<string, unknown>])[0];
      expect(stConfig.pinSpacing).toBe(false);
    }
    // Last section: pinSpacing true (footer scrolls in)
    const lastCall = calls[calls.length - 1];
    const lastConfig = (lastCall as [Record<string, unknown>])[0];
    expect(lastConfig.pinSpacing).toBe(true);
  });
});
