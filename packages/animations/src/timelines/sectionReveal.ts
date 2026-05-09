import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createReducedMotionSafe, type KillableTimeline } from '../reduced-motion.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Raw section reveal factory (REQ-ANIM-2).
 *
 * Animates [data-section-header] and [data-section-content] on scroll entry
 * using a GSAP timeline with ScrollTrigger (start: 'top 80%', once: true).
 *
 * - If neither selector is found → returns a no-op early (no ScrollTrigger created).
 * - header → fade-up: opacity 0→1, y 24→0, 0.6s, power3.out
 * - content → fade-up: opacity 0→1, y 16→0, 0.5s, power2.out, overlaps header by 0.3s
 *
 * @param root - Container element that holds [data-section-header] and/or [data-section-content]
 * @returns KillableTimeline — call .kill() on unmount / astro:before-swap
 */
function createSectionRevealTimelineRaw(root: Element): KillableTimeline {
  const sectionHeader = root.querySelector('[data-section-header]');
  const content = root.querySelector('[data-section-content]');

  // Early exit: no targets → no animation, no ScrollTrigger
  if (!sectionHeader && !content) return { kill: () => {} };

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top 80%',
      once: true,
    },
  });

  if (sectionHeader) {
    tl.from(sectionHeader, {
      opacity: 0,
      y: 24,
      duration: 0.6,
      ease: 'power3.out',
    });
  }

  if (content) {
    tl.from(
      content,
      {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: 'power2.out',
      },
      '-=0.3'
    );
  }

  return tl;
}

/**
 * Reduced-motion-safe section reveal timeline factory.
 *
 * Returns a no-op (NoOpTimeline with kill()) when:
 * - SSR context (no window)
 * - prefers-reduced-motion: reduce
 * - root contains neither [data-section-header] nor [data-section-content]
 *
 * Otherwise: creates a ScrollTrigger-driven fade-up timeline for section entry.
 *
 * Per ADR-11: ALL new animation factories MUST be wrapped with createReducedMotionSafe.
 * CLIENT-ONLY: call in useEffect / onMount.
 */
export const createSectionRevealTimeline = createReducedMotionSafe(createSectionRevealTimelineRaw);
