import Lenis from 'lenis';

export interface SmoothScrollOptions {
  wrapper?: HTMLElement | Window | Element;
  smoothWheel?: boolean;
  duration?: number;
}

/**
 * Lenis smooth scroll without GSAP. Same guards and defaults as `initLenis`
 * (null during SSR and on coarse pointers), but this entry point imports only
 * `lenis`: going through the package barrel pulled gsap and ScrollTrigger into
 * the hero bundle (~90 KB raw) just to start a scroller.
 *
 * Lenis drives its own frame loop (`autoRaf`), which `destroy()` cancels; the
 * hand-rolled loop in `initLenis` kept running after the instance was gone.
 */
export function initSmoothScroll(opts: SmoothScrollOptions = {}): Lenis | null {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(pointer: coarse)').matches) return null;

  return new Lenis({
    smoothWheel: opts.smoothWheel ?? true,
    duration: opts.duration ?? 1.2,
    autoRaf: true,
    ...(opts.wrapper !== undefined ? { wrapper: opts.wrapper } : {}),
  });
}
