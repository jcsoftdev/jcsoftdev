/**
 * TDD RED → GREEN — OrbCursor.tsx component tests.
 *
 * Tests:
 * 1. Mount registers pointermove listener on window
 * 2. Unmount removes the pointermove listener
 * 3. prefers-reduced-motion → no listener registered, orb stays at center
 * 4. pointer:coarse → no listener registered
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('OrbCursor', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalMatchMedia = window.matchMedia;
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('mount registers pointermove listener on window (fine pointer, no reduced motion)', async () => {
    // Default matchMedia stub returns matches: false for all queries
    // → fine pointer, no reduced-motion → should register listener
    const { default: OrbCursor } = await import('./OrbCursor.js');
    render(<OrbCursor />);

    const calls = addEventListenerSpy.mock.calls.map(([event]) => event);
    expect(calls).toContain('pointermove');
  });

  it('unmount removes pointermove listener', async () => {
    const { default: OrbCursor } = await import('./OrbCursor.js');
    const { unmount } = render(<OrbCursor />);

    unmount();

    const removedEvents = removeEventListenerSpy.mock.calls.map(([event]) => event);
    expect(removedEvents).toContain('pointermove');
  });

  it('prefers-reduced-motion: reduce → no pointermove listener registered', async () => {
    // Mock matchMedia to return matches:true for reduced-motion query
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    // Re-import to pick up new matchMedia (module may cache)
    vi.resetModules();
    const { default: OrbCursor } = await import('./OrbCursor.js');
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    render(<OrbCursor />);

    const pointerMoveCalls = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'pointermove'
    );
    expect(pointerMoveCalls).toHaveLength(0);
  });

  it('pointer:coarse → no pointermove listener registered', async () => {
    // Mock matchMedia to return matches:true for pointer:coarse query
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('pointer: coarse') || query.includes('pointer:coarse'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    vi.resetModules();
    const { default: OrbCursor } = await import('./OrbCursor.js');
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    render(<OrbCursor />);

    const pointerMoveCalls = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'pointermove'
    );
    expect(pointerMoveCalls).toHaveLength(0);
  });
});
