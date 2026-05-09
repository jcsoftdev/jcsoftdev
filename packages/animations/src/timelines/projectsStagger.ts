import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createReducedMotionSafe } from '../reduced-motion.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Raw factory (not exported directly — consumers receive the reduced-motion-safe variant).
 *
 * Animates project cards inside `root` using ScrollTrigger stagger fade.
 * Selector: [data-portfolio-project-card]
 * Stagger: 0.08s per card, y: 40→0, opacity: 0→1, duration: 0.6s (design §7)
 */
function _createProjectsStaggerTimeline(root: Element): gsap.core.Timeline {
  const cards = root.querySelectorAll('[data-portfolio-project-card]');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    },
  });

  if (cards.length > 0) {
    tl.from(cards, {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power3.out',
    });
  }

  return tl;
}

/**
 * Creates a scroll-triggered stagger animation for project cards.
 *
 * Pre-wrapped with `createReducedMotionSafe` — consumers cannot import
 * the unwrapped variant. Returns a no-op timeline when:
 * - `prefers-reduced-motion: reduce` matches
 * - Running in SSR/Node context (typeof window === 'undefined')
 *
 * @param root - The section root element containing [data-portfolio-project-card] children
 * @returns KillableTimeline — call .kill() on unmount
 */
export const createProjectsStaggerTimeline = createReducedMotionSafe(
  _createProjectsStaggerTimeline
);
