import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for initLenis mobile guard (ADR-12).
 *
 * initLenis must:
 * - Return null when typeof window === 'undefined' (SSR)
 * - Return null when window.matchMedia('(pointer: coarse)').matches (touch/mobile)
 * - Initialize Lenis and return the instance when pointer is fine
 */

// Mock Lenis at module level so we can inspect constructor calls without needing DOM
const mockLenisInstance = { destroy: vi.fn(), raf: vi.fn() };
let constructorCallCount = 0;

// Must use `function` (not arrow) to be newable
function MockLenis(this: unknown, _opts?: unknown) {
  constructorCallCount++;
  return mockLenisInstance;
}

vi.mock('lenis', () => ({
  default: MockLenis,
}));

describe('initLenis mobile guard', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
    constructorCallCount = 0;
    vi.clearAllMocks();
  });

  function setupWindow(pointerCoarse: boolean) {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: pointerCoarse }),
      requestAnimationFrame: vi.fn().mockReturnValue(1),
    };
  }

  it('returns null when typeof window === "undefined" (SSR)', async () => {
    delete (globalThis as Record<string, unknown>).window;

    const { initLenis } = await import('./lenis.js');
    const result = initLenis();

    expect(result).toBeNull();
  });

  it('does not throw when typeof window === "undefined"', async () => {
    delete (globalThis as Record<string, unknown>).window;

    const { initLenis } = await import('./lenis.js');
    expect(() => initLenis()).not.toThrow();
  });

  it('returns null when pointer is coarse (touch/mobile device)', async () => {
    setupWindow(true);

    const { initLenis } = await import('./lenis.js');
    const result = initLenis();

    expect(result).toBeNull();
  });

  it('does not call Lenis constructor when pointer is coarse', async () => {
    setupWindow(true);

    const { initLenis } = await import('./lenis.js');
    initLenis();

    expect(constructorCallCount).toBe(0);
  });

  it('checks matchMedia for pointer:coarse when pointer is coarse', async () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    (globalThis as Record<string, unknown>).window = {
      matchMedia: matchMediaMock,
      requestAnimationFrame: vi.fn(),
    };

    const { initLenis } = await import('./lenis.js');
    initLenis();

    expect(matchMediaMock).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('initializes Lenis and returns instance when pointer is fine', async () => {
    setupWindow(false);

    const { initLenis } = await import('./lenis.js');
    const result = initLenis();

    expect(constructorCallCount).toBe(1);
    expect(result).toBe(mockLenisInstance);
  });

  it('schedules requestAnimationFrame when pointer is fine', async () => {
    const rafMock = vi.fn().mockReturnValue(1);
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      requestAnimationFrame: rafMock,
    };

    const { initLenis } = await import('./lenis.js');
    initLenis();

    expect(rafMock).toHaveBeenCalledOnce();
  });
});
