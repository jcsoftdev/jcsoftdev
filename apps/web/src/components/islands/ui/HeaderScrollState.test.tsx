/**
 * TDD RED → GREEN — HeaderScrollState.tsx component tests.
 *
 * Tests:
 * 1. IntersectionObserver mocked; sentinel exits viewport → header gets data-scrolled="true"
 * 2. Sentinel re-enters viewport → data-scrolled removed / set to "false"
 * 3. Cleanup on unmount disconnects observer
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// IntersectionObserver mock — must be a class (constructor) for `new` to work
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let capturedCallback: IOCallback | null = null;
let disconnectSpy: ReturnType<typeof vi.fn>;

class MockIntersectionObserver {
  constructor(callback: IOCallback) {
    capturedCallback = callback;
    disconnectSpy = vi.fn();
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = () => disconnectSpy();
}

const mockIntersectionObserver = MockIntersectionObserver;

describe('HeaderScrollState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = null;

    // Install mock
    vi.stubGlobal('IntersectionObserver', mockIntersectionObserver);

    // Set up DOM: sentinel + header
    document.body.innerHTML = `
      <div id="header-sentinel" style="position:absolute;top:16px;height:1px;width:1px"></div>
      <header data-scrolled="false"></header>
    `;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('sentinel exits viewport → header gets data-scrolled="true"', async () => {
    const { default: HeaderScrollState } = await import('./HeaderScrollState.js');
    render(<HeaderScrollState />);

    const header = document.querySelector('header')!;
    expect(header).toBeTruthy();

    // Simulate sentinel exiting viewport (intersecting = false means it left)
    capturedCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);

    expect(header.dataset.scrolled).toBe('true');
  });

  it('sentinel re-enters viewport → data-scrolled set to "false"', async () => {
    const { default: HeaderScrollState } = await import('./HeaderScrollState.js');
    render(<HeaderScrollState />);

    const header = document.querySelector('header')!;

    // First scroll past sentinel
    capturedCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    expect(header.dataset.scrolled).toBe('true');

    // Then scroll back to top
    capturedCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(header.dataset.scrolled).toBe('false');
  });

  it('unmount disconnects the IntersectionObserver', async () => {
    const { default: HeaderScrollState } = await import('./HeaderScrollState.js');
    const { unmount } = render(<HeaderScrollState />);

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
