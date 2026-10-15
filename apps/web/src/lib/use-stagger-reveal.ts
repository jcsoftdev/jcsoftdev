import { type RefObject, useEffect } from 'react';
import { staggerDelay } from './stagger.js';

/**
 * Reveals `[data-stagger]` rows inside `ref` as they scroll into view, by
 * setting `data-in` on them (CSS owns the visuals). The container gets
 * `data-in` the first time it is in view, which draws the experience timeline.
 *
 * Needed because client:visible islands hydrate after the page-level section
 * observer has already run: an in-island observer starts from whatever is on
 * screen at mount, so nothing is left hidden. Reduced motion, a missing
 * IntersectionObserver or matchMedia reveal everything at once.
 */
export function useStaggerReveal(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-stagger]'));
    const targets = [root, ...rows];

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      for (const el of targets) el.setAttribute('data-in', '');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        let batch = 0;
        for (const entry of visible) {
          const el = entry.target as HTMLElement;
          if (el !== root) el.style.setProperty('--stagger-delay', `${staggerDelay(batch++)}ms`);
          el.setAttribute('data-in', '');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}
