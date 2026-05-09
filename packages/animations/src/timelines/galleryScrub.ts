import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { KillableTimeline } from '../reduced-motion.js';
import { createReducedMotionSafe } from '../reduced-motion.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Raw gallery scrub factory (Phase 6 — ADR-22).
 *
 * Creates GSAP ScrollTrigger pin + scrub for each [data-gallery-section] inside `root`.
 *
 * Per-section config:
 * - pin: true, scrub: 1, start: 'top top', end: '+=100%'
 * - Non-last sections: pinSpacing: false (sections stack without extra space)
 * - Last section: pinSpacing: true (footer scrolls into view cleanly)
 * - Cross-fade: outgoing sections fade opacity 0 + scale 0.95 in last 30% of scroll range
 * - Incoming: first section has no opacity tween; subsequent ones rely on pin order
 *
 * Requires `initLenis({ withScrollTriggerBridge: true })` to be called BEFORE this factory.
 * (caller's responsibility per REQ-GALLERY-7 — behavior undefined without bridge)
 *
 * @param root - Container element holding [data-gallery-section] children
 * @returns KillableTimeline — call .kill() on unmount + astro:before-swap
 */
function _galleryScrubFactory(root: Element): KillableTimeline {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-gallery-section]'));

  const triggers: ScrollTrigger[] = [];

  sections.forEach((sec, i) => {
    const isLast = i === sections.length - 1;

    // Pin timeline for this section
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: '+=100%',
        pin: true,
        pinSpacing: isLast,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // Outgoing fade + scale in last 30% of scroll range (all sections except the last)
    if (!isLast) {
      tl.to(sec, { opacity: 0, scale: 0.95, ease: 'none' }, 0.7);
    }

    if (tl.scrollTrigger) {
      triggers.push(tl.scrollTrigger);
    }
  });

  return {
    kill() {
      for (const t of triggers) {
        t.kill();
      }
    },
  };
}

/**
 * Reduced-motion-safe gallery scrub timeline factory.
 *
 * Returns a no-op (NoOpTimeline with kill()) when:
 * - SSR context (no window)
 * - prefers-reduced-motion: reduce
 *
 * Otherwise: creates ScrollTrigger pin + scrub per gallery section.
 *
 * Per ADR-11: ALL new animation factories MUST be wrapped with createReducedMotionSafe.
 * CLIENT-ONLY: call in useEffect / onMount.
 */
export const createGalleryScrubTimeline = createReducedMotionSafe(_galleryScrubFactory);
