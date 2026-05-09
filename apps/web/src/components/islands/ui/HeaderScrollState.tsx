import { useEffect } from 'react';

/**
 * HeaderScrollState — pure side-effect component.
 *
 * Observes the #header-sentinel element via IntersectionObserver.
 * When the sentinel exits the viewport (page scrolled), sets
 * data-scrolled="true" on the nearest <header> element.
 * When the sentinel re-enters (back to top), sets data-scrolled="false".
 *
 * Returns null — no rendered output.
 */
export default function HeaderScrollState() {
  useEffect(() => {
    const sentinel = document.getElementById('header-sentinel');
    const header = document.querySelector('header');

    if (!sentinel || !header) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          header.dataset.scrolled = entry.isIntersecting ? 'false' : 'true';
        }
      },
      {
        threshold: 0,
        rootMargin: '0px',
      }
    );

    observer.observe(sentinel);

    const handleBeforeSwap = () => observer.disconnect();
    document.addEventListener('astro:before-swap', handleBeforeSwap, { once: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('astro:before-swap', handleBeforeSwap);
    };
  }, []);

  return null;
}
