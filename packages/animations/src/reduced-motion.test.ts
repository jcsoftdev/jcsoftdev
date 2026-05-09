import { afterEach, describe, expect, it, vi } from 'vitest';

// We import lazily inside each test so we can control the global environment

describe('createReducedMotionSafe', () => {
  const realWindow = globalThis.window;

  afterEach(() => {
    // Restore window after each test
    if (realWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = realWindow;
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  function mockMatchMedia(matches: boolean) {
    (globalThis as Record<string, unknown>).window = {
      matchMedia: vi.fn().mockReturnValue({ matches }),
    };
  }

  it('returns no-op timeline when prefers-reduced-motion: reduce matches', async () => {
    mockMatchMedia(true);
    const { createReducedMotionSafe } = await import('./reduced-motion.js');

    const factory = vi.fn().mockReturnValue({ kill: vi.fn() });
    const wrapped = createReducedMotionSafe(factory);
    const el = {} as Element;

    const timeline = wrapped(el);

    expect(factory).not.toHaveBeenCalled();
    expect(typeof timeline.kill).toBe('function');
    expect(() => timeline.kill()).not.toThrow();
  });

  it('calls kill twice without throwing on no-op timeline', async () => {
    mockMatchMedia(true);
    const { createReducedMotionSafe } = await import('./reduced-motion.js');

    const factory = vi.fn();
    const wrapped = createReducedMotionSafe(factory);
    const timeline = wrapped({} as Element);

    expect(() => {
      timeline.kill();
      timeline.kill();
    }).not.toThrow();
  });

  it('delegates to the real factory when reduced motion does not match', async () => {
    mockMatchMedia(false);
    const { createReducedMotionSafe } = await import('./reduced-motion.js');

    const killFn = vi.fn();
    const realTimeline = { kill: killFn };
    const factory = vi.fn().mockReturnValue(realTimeline);
    const wrapped = createReducedMotionSafe(factory);
    const el = {} as Element;

    const result = wrapped(el);

    expect(factory).toHaveBeenCalledWith(el);
    expect(result).toBe(realTimeline);
  });

  it('returns no-op timeline in SSR context (no window)', async () => {
    // Remove window from globalThis to simulate SSR
    delete (globalThis as Record<string, unknown>).window;

    const { createReducedMotionSafe } = await import('./reduced-motion.js');

    const factory = vi.fn();
    const wrapped = createReducedMotionSafe(factory);

    let result: { kill(): void } | undefined;
    expect(() => {
      result = wrapped({} as Element);
    }).not.toThrow();

    expect(factory).not.toHaveBeenCalled();
    expect(typeof result?.kill).toBe('function');
  });

  it('kill is idempotent on real timeline (no double-kill throw)', async () => {
    mockMatchMedia(false);
    const { createReducedMotionSafe } = await import('./reduced-motion.js');

    const killFn = vi.fn();
    const factory = vi.fn().mockReturnValue({ kill: killFn });
    const wrapped = createReducedMotionSafe(factory);
    const timeline = wrapped({} as Element);

    timeline.kill();
    timeline.kill();

    expect(killFn).toHaveBeenCalledTimes(2);
  });
});
