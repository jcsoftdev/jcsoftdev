import { afterEach, describe, expect, it, vi } from 'vitest';

const constructed: unknown[] = [];
function MockLenis(this: unknown, opts?: unknown) {
  constructed.push(opts);
  return { destroy: vi.fn() };
}
vi.mock('lenis', () => ({ default: MockLenis }));
vi.mock('gsap', () => {
  throw new Error('smooth-scroll must not import gsap');
});

describe('initSmoothScroll', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  afterEach(() => {
    if (originalWindow === undefined) delete (globalThis as Record<string, unknown>).window;
    else (globalThis as Record<string, unknown>).window = originalWindow;
    constructed.length = 0;
  });

  function setupWindow(coarse: boolean) {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches: coarse }),
    };
  }

  it('returns null during SSR', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { initSmoothScroll } = await import('./smooth-scroll.js');
    expect(initSmoothScroll()).toBeNull();
  });

  it('returns null on a coarse pointer', async () => {
    setupWindow(true);
    const { initSmoothScroll } = await import('./smooth-scroll.js');
    expect(initSmoothScroll()).toBeNull();
    expect(constructed).toHaveLength(0);
  });

  it('starts Lenis with the initLenis defaults and its own frame loop', async () => {
    setupWindow(false);
    const { initSmoothScroll } = await import('./smooth-scroll.js');
    expect(initSmoothScroll()).not.toBeNull();
    expect(constructed[0]).toEqual({ smoothWheel: true, duration: 1.2, autoRaf: true });
  });
});
