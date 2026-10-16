import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Magnetic from './Magnetic';

/** Manual frame queue so the test decides when frames happen. */
let frames: FrameRequestCallback[] = [];
function flushFrames(max = 500): number {
  let ran = 0;
  while (frames.length > 0 && ran < max) {
    const batch = frames;
    frames = [];
    for (const cb of batch) cb(performance.now());
    ran += 1;
  }
  return ran;
}

describe('Magnetic', () => {
  beforeEach(() => {
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: false, media: query }) as MediaQueryList
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not run a frame loop while the pointer is away', () => {
    render(
      <Magnetic>
        <a href="#work">Work</a>
      </Magnetic>
    );
    expect(frames).toHaveLength(0);
  });

  it('follows the pointer, springs back on leave, then stops ticking', () => {
    const { container } = render(
      <Magnetic strength={0.5}>
        <a href="#work">Work</a>
      </Magnetic>
    );
    const wrap = container.firstElementChild as HTMLElement;

    fireEvent.pointerMove(wrap, { clientX: 100, clientY: 0 });
    flushFrames();
    expect(wrap.style.transform).toBe('translate3d(50px, 0px, 0)');
    expect(frames).toHaveLength(0);

    fireEvent.pointerLeave(wrap);
    const ran = flushFrames();
    expect(ran).toBeGreaterThan(1);
    expect(ran).toBeLessThan(500);
    expect(wrap.style.transform).toBe('translate3d(0px, 0px, 0)');
    expect(frames).toHaveLength(0);
  });
});
