import { describe, expect, it, vi } from 'vitest';

describe('HeroIsland import', () => {
  it('can import HeroIsland component without crashing (static check)', async () => {
    // Dynamic import to avoid SSR window errors in Node environment.
    // This validates the module graph resolves without import errors.
    const mod = await import('./components/HeroIsland.js');
    expect(typeof mod.default).toBe('function');
  });
});

describe('HeroIsland Lenis null-safety (task 2.6)', () => {
  it('animations package initLenis returns null on coarse-pointer device (ADR-12)', async () => {
    // Verifies the Lenis | null breaking change (ADR-12): coarse pointer (touch) returns null.
    // jsdom environment: window exists, so the SSR guard does not trigger.
    // Temporarily override matchMedia to simulate a touch/coarse-pointer device.
    const original = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    // initLenis uses module-level import — re-import to get fresh call
    const { initLenis } = await import('@jcsoftdev/animations');
    expect(initLenis()).toBeNull();

    // Restore
    window.matchMedia = original;
  });

  it('animations package createHeroFadeTimeline is a function (barrel check)', async () => {
    const { createHeroFadeTimeline } = await import('@jcsoftdev/animations');
    expect(typeof createHeroFadeTimeline).toBe('function');
  });

  it('createHeroFadeTimeline returns killable no-op in SSR context', async () => {
    const { createHeroFadeTimeline } = await import('@jcsoftdev/animations');
    const stubEl = {
      querySelector: vi.fn().mockReturnValue(null),
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as unknown as Element;

    // No window in node env — must return no-op without throwing
    let result: { kill(): void } | undefined;
    expect(() => {
      result = createHeroFadeTimeline(stubEl);
    }).not.toThrow();

    expect(typeof result?.kill).toBe('function');
    // kill() must be callable without error
    expect(() => result?.kill()).not.toThrow();
  });
});
