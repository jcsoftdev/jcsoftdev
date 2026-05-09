import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createReducedMotionSafe } from '../reduced-motion.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Raw factory (not exported directly — consumers receive the reduced-motion-safe variant).
 *
 * Animates experience cards inside `root` using ScrollTrigger fade-up.
 * Selector: [data-portfolio-experience-card]
 * Stagger: 0.1s per card, y: 30→0, opacity: 0→1, duration: 0.5s (design §7)
 */
function _createExperienceFadeUpTimeline(root: Element): gsap.core.Timeline {
  const cards = root.querySelectorAll('[data-portfolio-experience-card]');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    },
  });

  if (cards.length > 0) {
    tl.from(cards, {
      y: 30,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power3.out',
    });
  }

  return tl;
}

/**
 * Creates a scroll-triggered fade-up animation for experience cards.
 *
 * Pre-wrapped with `createReducedMotionSafe` — consumers cannot import
 * the unwrapped variant. Returns a no-op timeline when:
 * - `prefers-reduced-motion: reduce` matches
 * - Running in SSR/Node context (typeof window === 'undefined')
 *
 * @param root - The section root element containing [data-portfolio-experience-card] children
 * @returns KillableTimeline — call .kill() on unmount
 */
export const createExperienceFadeUpTimeline = createReducedMotionSafe(
  _createExperienceFadeUpTimeline
);
