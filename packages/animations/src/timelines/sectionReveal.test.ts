/**
 * TDD RED → GREEN — createSectionRevealTimeline factory tests (Phase 8 / REQ-ANIM-2).
 *
 * Tests:
 * 1. Factory is exported from timelines/sectionReveal module
 * 2. Factory is exported from @jcsoftdev/animations barrel index
 * 3. Reduced-motion → returns NoOpTimeline (no ScrollTrigger created)
 * 4. SSR (no window) → returns NoOpTimeline
 * 5. Full path: ScrollTrigger created with trigger: root, start: 'top 80%', once: true
 * 6. Header + content both present → both tweens added
 * 7. Only header present → header tween added
 * 8. Only content present → content tween added
 * 9. Neither present → returns NoOp (no tweens, no ScrollTrigger)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock GSAP + ScrollTrigger
// ---------------------------------------------------------------------------

const mockKillTimeline = vi.fn();
const mockFrom = vi.fn().mockReturnThis();

const mockScrollTriggerCreate = vi.fn((vars: Record<string, unknown>) => {
  const instance = { kill: vi.fn(), vars };
  return instance;
});

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    timeline: vi.fn((opts: Record<string, unknown>) => {
      const st = opts?.scrollTrigger
        ? mockScrollTriggerCreate(opts.scrollTrigger as Record<string, unknown>)
        : null;
      const tl = {
        scrollTrigger: st,
        from: mockFrom,
        kill: mockKillTimeline,
      };
      // mockFrom.mockReturnThis() returns `tl` implicitly via chaining
      return tl;
    }),
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

function makeRootWith({
  header = false,
  content = false,
}: {
  header?: boolean;
  content?: boolean;
} = {}): HTMLElement {
  return {
    querySelector: vi.fn((selector: string) => {
      if (selector === '[data-section-header]') return header ? {} : null;
      if (selector === '[data-section-content]') return content ? {} : null;
      return null;
    }),
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
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createSectionRevealTimeline — module export', () => {
  it('is exported from timelines/sectionReveal module', async () => {
    const mod = await import('./sectionReveal.js');
    expect(typeof mod.createSectionRevealTimeline).toBe('function');
  });
});

describe('createSectionRevealTimeline — barrel export', () => {
  it('is exported from @jcsoftdev/animations barrel index', async () => {
    const mod = await import('../index.js');
    expect(typeof (mod as Record<string, unknown>).createSectionRevealTimeline).toBe('function');
  });
});

describe('createSectionRevealTimeline — reduced-motion + SSR guards', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  it('returns NoOpTimeline when prefers-reduced-motion: reduce is active', async () => {
    setupWindow(true);
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: true, content: true });

    const result = createSectionRevealTimeline(root);

    expect(() => result.kill()).not.toThrow();
    expect(mockScrollTriggerCreate).not.toHaveBeenCalled();
  });

  it('returns NoOpTimeline in SSR context (no window)', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: true, content: true });

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createSectionRevealTimeline(root);
    }).not.toThrow();
    expect(() => result?.kill()).not.toThrow();
    expect(mockScrollTriggerCreate).not.toHaveBeenCalled();
  });
});

describe('createSectionRevealTimeline — ScrollTrigger config', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupWindow(false);
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  it('creates ScrollTrigger with trigger: root, start: "top 80%", once: true', async () => {
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: true, content: true });

    createSectionRevealTimeline(root);

    expect(mockScrollTriggerCreate).toHaveBeenCalledTimes(1);
    const stConfig = mockScrollTriggerCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(stConfig.trigger).toBe(root);
    expect(stConfig.start).toBe('top 80%');
    expect(stConfig.once).toBe(true);
  });

  it('adds two tweens when both header and content are present', async () => {
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: true, content: true });

    createSectionRevealTimeline(root);

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('adds only one tween when only header is present', async () => {
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: true, content: false });

    createSectionRevealTimeline(root);

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('adds only one tween when only content is present', async () => {
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: false, content: true });

    createSectionRevealTimeline(root);

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('returns NoOp when neither header nor content is present', async () => {
    const { createSectionRevealTimeline } = await import('./sectionReveal.js');
    const root = makeRootWith({ header: false, content: false });

    const result = createSectionRevealTimeline(root);

    expect(() => result.kill()).not.toThrow();
    expect(mockScrollTriggerCreate).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
