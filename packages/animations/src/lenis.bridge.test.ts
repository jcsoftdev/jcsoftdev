/**
 * TDD RED → GREEN — initLenis ScrollTrigger bridge extension tests (Phase 6 / task 6.1 → 6.2).
 *
 * Tests:
 * 1. Bridge OFF (default) → ScrollTrigger.scrollerProxy NOT called
 * 2. Bridge OFF (explicit false) → ScrollTrigger.scrollerProxy NOT called
 * 3. Bridge ON → ScrollTrigger.scrollerProxy called with document.body
 * 4. Bridge ON → gsap.ticker.add registered
 * 5. Bridge ON → lenis.on('scroll', ...) registered
 * 6. Bridge ON → gsap.ticker.lagSmoothing(0) called
 * 7. Bridge ON → rAF loop NOT scheduled (ticker replaces rAF)
 * 8. Bridge OFF → rAF loop IS scheduled (current behavior preserved)
 * 9. SSR guard still applies when bridge is enabled
 * 10. Coarse-pointer guard still applies when bridge is enabled
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Lenis
// ---------------------------------------------------------------------------

const mockLenisInstance = {
  destroy: vi.fn(),
  raf: vi.fn(),
  on: vi.fn(),
  scroll: 0,
  scrollTo: vi.fn(),
};

function MockLenis(this: unknown, _opts?: unknown) {
  return mockLenisInstance;
}

vi.mock('lenis', () => ({ default: MockLenis }));

// ---------------------------------------------------------------------------
// Mock GSAP + ScrollTrigger
// ---------------------------------------------------------------------------

const mockScrollerProxy = vi.fn();
const mockScrollTriggerUpdate = vi.fn();
const mockScrollTriggerDefaults = vi.fn();

const mockTickerAdd = vi.fn();
const mockTickerLagSmoothing = vi.fn();

vi.mock('gsap', () => ({
  default: {
    registerPlugin: vi.fn(),
    ticker: {
      add: mockTickerAdd,
      lagSmoothing: mockTickerLagSmoothing,
    },
  },
}));

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    scrollerProxy: mockScrollerProxy,
    update: mockScrollTriggerUpdate,
    defaults: mockScrollTriggerDefaults,
  },
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockDocument = {
  body: {
    style: { transform: '' },
  },
};

function setupWindow(pointerCoarse = false) {
  (globalThis as Record<string, unknown>).window = {
    matchMedia: vi.fn().mockReturnValue({ matches: pointerCoarse }),
    requestAnimationFrame: vi.fn().mockReturnValue(99),
    innerWidth: 1440,
    innerHeight: 900,
  };
  // document must be accessible as a global in the lenis.ts module
  (globalThis as Record<string, unknown>).document = mockDocument;
}

describe('initLenis — bridge flag OFF (backward compat)', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

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
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  });

  it('does NOT call ScrollTrigger.scrollerProxy when bridge is omitted', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis();
    expect(mockScrollerProxy).not.toHaveBeenCalled();
  });

  it('does NOT call ScrollTrigger.scrollerProxy when bridge is explicitly false', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: false });
    expect(mockScrollerProxy).not.toHaveBeenCalled();
  });

  it('schedules rAF loop when bridge is off (existing behavior)', async () => {
    const rafMock = vi.fn().mockReturnValue(1);
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      requestAnimationFrame: rafMock,
    };
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: false });
    expect(rafMock).toHaveBeenCalledOnce();
  });

  it('does NOT call gsap.ticker.add when bridge is off', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis();
    expect(mockTickerAdd).not.toHaveBeenCalled();
  });
});

describe('initLenis — bridge flag ON', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

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
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  });

  it('calls ScrollTrigger.scrollerProxy with document.body when bridge is enabled', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: true });
    expect(mockScrollerProxy).toHaveBeenCalledWith(
      mockDocument.body,
      expect.objectContaining({
        scrollTop: expect.any(Function),
        getBoundingClientRect: expect.any(Function),
      })
    );
  });

  it('registers gsap.ticker.add when bridge is enabled', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: true });
    expect(mockTickerAdd).toHaveBeenCalledWith(expect.any(Function));
  });

  it('registers lenis.on("scroll", ...) when bridge is enabled', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: true });
    expect(mockLenisInstance.on).toHaveBeenCalledWith('scroll', mockScrollTriggerUpdate);
  });

  it('calls gsap.ticker.lagSmoothing(0) when bridge is enabled', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: true });
    expect(mockTickerLagSmoothing).toHaveBeenCalledWith(0);
  });

  it('does NOT schedule rAF loop when bridge is enabled (ticker replaces rAF)', async () => {
    const rafMock = vi.fn().mockReturnValue(99);
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      requestAnimationFrame: rafMock,
      innerWidth: 1440,
      innerHeight: 900,
    };
    (globalThis as Record<string, unknown>).document = mockDocument;
    const { initLenis } = await import('./lenis.js');
    initLenis({ withScrollTriggerBridge: true });
    expect(rafMock).not.toHaveBeenCalled();
  });

  it('returns Lenis instance when bridge is enabled (fine pointer, no SSR)', async () => {
    setupWindow(false);
    const { initLenis } = await import('./lenis.js');
    const result = initLenis({ withScrollTriggerBridge: true });
    expect(result).toBe(mockLenisInstance);
  });
});

describe('initLenis — guards still apply with bridge enabled', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  const originalDocument = (globalThis as Record<string, unknown>).document;

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
    if (originalDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = originalDocument;
    }
  });

  it('returns null in SSR even when bridge flag is true', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { initLenis } = await import('./lenis.js');
    const result = initLenis({ withScrollTriggerBridge: true });
    expect(result).toBeNull();
    expect(mockScrollerProxy).not.toHaveBeenCalled();
  });

  it('returns null on coarse pointer even when bridge flag is true', async () => {
    setupWindow(true);
    const { initLenis } = await import('./lenis.js');
    const result = initLenis({ withScrollTriggerBridge: true });
    expect(result).toBeNull();
    expect(mockScrollerProxy).not.toHaveBeenCalled();
  });
});
