import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Creates a hero fade-in/slide-up GSAP timeline.
 *
 * CLIENT-ONLY: must be called after DOM is ready (useEffect / onMount).
 *
 * Expects the target element to contain:
 * - [data-hero-title]  — main heading
 * - [data-hero-sub]    — subheading / description
 * - [data-hero-cta]    — CTA anchor(s) container (optional, fades in after sub)
 *
 * NOTE: The exported variant in index.ts is pre-wrapped with createReducedMotionSafe.
 * This raw factory is not exported from the package barrel — import from index.
 *
 * @param target - The hero root Element
 * @returns GSAP Timeline instance — call .kill() in cleanup
 */
export function createHeroFadeTimeline(target: Element): gsap.core.Timeline {
  const title = target.querySelector<HTMLElement>('[data-hero-title]');
  const sub = target.querySelector<HTMLElement>('[data-hero-sub]');
  const cta = target.querySelector<HTMLElement>('[data-hero-cta]');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: target,
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  if (title) {
    tl.from(title, {
      y: 60,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
    });
  }

  if (sub) {
    tl.from(
      sub,
      {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
      },
      '-=0.4'
    );
  }

  if (cta) {
    tl.from(
      cta,
      {
        y: 20,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.05,
      },
      '-=0.3'
    );
  }

  return tl;
}
