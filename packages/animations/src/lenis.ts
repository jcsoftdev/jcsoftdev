import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register ScrollTrigger plugin eagerly (ADR-21: static import, no async).
// Safe: gsap is already in the bundle for Hero animations. ScrollTrigger (~12KB gzip)
// is acceptable for the portfolio page (the only consumer with bridge enabled).
gsap.registerPlugin(ScrollTrigger);

export interface LenisOptions {
  wrapper?: HTMLElement | Window | Element;
  smoothWheel?: boolean;
  duration?: number;
  /**
   * ADR-21 — opt-in Lenis ↔ GSAP ScrollTrigger bridge.
   *
   * When true:
   * - ScrollTrigger.scrollerProxy(document.body, ...) is registered so GSAP
   *   reads scroll position from Lenis instead of the native scroll container.
   * - gsap.ticker.add() drives lenis.raf() (single RAF source of truth).
   * - lenis.on('scroll', ScrollTrigger.update) keeps triggers in sync.
   *
   * When false (default): identical to the existing implementation.
   * In V1 only ImmersiveProjectsGallery passes this flag.
   */
  withScrollTriggerBridge?: boolean;
}

/**
 * Initializes Lenis smooth scroll.
 *
 * CLIENT-ONLY guards (both return null):
 * - SSR / Node environment (typeof window === 'undefined')
 * - Touch/coarse-pointer devices (matchMedia('(pointer: coarse)').matches)
 *   Per ADR-12: `pointer: coarse` is the standard media-query for touch devices;
 *   UA sniffing is brittle and explicitly rejected.
 *
 * BREAKING CHANGE (from previous `Lenis` return / throw):
 *   Return type is now `Lenis | null`.
 *   Call site (HeroIsland.tsx) already uses optional chain `lenis?.destroy()` — safe.
 *
 * @returns Lenis instance on fine-pointer desktop browsers, null otherwise.
 */
export function initLenis(opts: LenisOptions = {}): Lenis | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  const lenisOpts: ConstructorParameters<typeof Lenis>[0] = {
    smoothWheel: opts.smoothWheel ?? true,
    duration: opts.duration ?? 1.2,
  };

  if (opts.wrapper !== undefined) {
    lenisOpts.wrapper = opts.wrapper;
  }

  const lenis = new Lenis(lenisOpts);

  if (opts.withScrollTriggerBridge) {
    // Bridge mode: GSAP ticker drives Lenis — no separate rAF loop needed.
    ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value?: number) {
        if (typeof value === 'number') {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      // biome-ignore lint/suspicious/noExplicitAny: ScrollTrigger pinType expects string — body.style.transform is a string
      pinType: (document.body.style as any).transform ? 'transform' : 'fixed',
    });

    // Lenis scroll events → ScrollTrigger position updates
    lenis.on('scroll', ScrollTrigger.update);

    // Single RAF source: gsap.ticker drives lenis.raf
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // All ScrollTrigger instances default to reading from the proxied scroller
    ScrollTrigger.defaults({ scroller: document.body });
  } else {
    // Default rAF loop (existing behavior — backward compat preserved)
    function raf(time: number) {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    }

    window.requestAnimationFrame(raf);
  }

  return lenis;
}
