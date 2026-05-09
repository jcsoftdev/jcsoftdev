/**
 * TDD RED → GREEN — cursorOrb factory tests (Phase 4 / task 4.1 → 4.2).
 *
 * Tests:
 * 1. createCursorOrbTimeline is exported from the timelines/cursorOrb module
 * 2. createCursorOrbTimeline is exported from the barrel index
 * 3. Returns no-op (kill() no-throw) when prefers-reduced-motion: reduce
 * 4. Returns no-op in SSR context (no window)
 * 5. On fine-pointer + no reduced-motion: attaches pointermove listener on window
 * 6. kill() removes the pointermove listener
 * 7. Returns no-op on pointer:coarse (no listener registered)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

function makeOrbEl(): HTMLElement {
  return {
    style: { transform: '' },
  } as unknown as HTMLElement;
}

/** Filter mock.calls to find calls where first argument matches `eventName`. */
function pointerCalls(mockFn: ReturnType<typeof vi.fn>, eventName: string) {
  return mockFn.mock.calls.filter((args) => args[0] === eventName);
}

describe('createCursorOrbTimeline — module export', () => {
  it('is exported from timelines/cursorOrb module', async () => {
    const mod = await import('./cursorOrb.js');
    expect(typeof mod.createCursorOrbTimeline).toBe('function');
  });
});

describe('createCursorOrbTimeline — index barrel export', () => {
  it('is exported from @jcsoftdev/animations barrel index', async () => {
    const mod = await import('../index.js');
    expect(typeof (mod as Record<string, unknown>).createCursorOrbTimeline).toBe('function');
  });
});

describe('createCursorOrbTimeline — reduced-motion + SSR guards', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    vi.resetModules();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore window (some tests delete it)
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  it('returns no-op when prefers-reduced-motion: reduce is active', async () => {
    const addEventListenerMock = vi.fn();
    const matchMediaMock = vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    (globalThis as Record<string, unknown>).window = {
      matchMedia: matchMediaMock,
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
      innerWidth: 1024,
      innerHeight: 768,
      requestAnimationFrame: vi.fn(),
      cancelAnimationFrame: vi.fn(),
    };

    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();
    const result = createCursorOrbTimeline(orb);

    // kill() must not throw
    expect(() => result.kill()).not.toThrow();

    // No pointermove listener registered
    expect(pointerCalls(addEventListenerMock, 'pointermove')).toHaveLength(0);
  });

  it('returns no-op in SSR context (no window)', async () => {
    delete (globalThis as Record<string, unknown>).window;

    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();

    let result: { kill(): void } | undefined;
    expect(() => {
      result = createCursorOrbTimeline(orb);
    }).not.toThrow();

    expect(() => result?.kill()).not.toThrow();
  });

  it('returns no-op when pointer:coarse (touch device)', async () => {
    const matchMediaMock = vi.fn((query: string) => ({
      matches: query.includes('pointer: coarse') || query.includes('pointer:coarse'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    const addEventListenerMock = vi.fn();
    (globalThis as Record<string, unknown>).window = {
      matchMedia: matchMediaMock,
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
      innerWidth: 390,
      innerHeight: 844,
      requestAnimationFrame: vi.fn(),
      cancelAnimationFrame: vi.fn(),
    };

    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();
    const result = createCursorOrbTimeline(orb);

    expect(() => result.kill()).not.toThrow();
    expect(pointerCalls(addEventListenerMock, 'pointermove')).toHaveLength(0);
  });
});

describe('createCursorOrbTimeline — fine-pointer, no reduced-motion', () => {
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;
  let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    cancelAnimationFrameMock = vi.fn();

    const matchMediaMock = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    // capture the RAF callback so we can drive the animation loop
    const requestAnimationFrameMock = vi.fn(() => 42);

    (globalThis as Record<string, unknown>).window = {
      matchMedia: matchMediaMock,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      innerWidth: 1280,
      innerHeight: 800,
      requestAnimationFrame: requestAnimationFrameMock,
      cancelAnimationFrame: cancelAnimationFrameMock,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('attaches pointermove listener on window when conditions are met', async () => {
    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();
    createCursorOrbTimeline(orb);

    expect(pointerCalls(addEventListenerMock, 'pointermove')).toHaveLength(1);
  });

  it('kill() removes pointermove listener', async () => {
    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();
    const result = createCursorOrbTimeline(orb);

    result.kill();

    expect(pointerCalls(removeEventListenerMock, 'pointermove')).toHaveLength(1);
  });

  it('kill() cancels the rAF loop', async () => {
    const { createCursorOrbTimeline } = await import('./cursorOrb.js');
    const orb = makeOrbEl();
    const result = createCursorOrbTimeline(orb);

    result.kill();

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(42);
  });
});
