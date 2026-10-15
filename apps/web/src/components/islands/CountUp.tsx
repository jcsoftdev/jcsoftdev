import { useEffect, useLayoutEffect, useRef } from 'react';
import { countAt, formatCount } from '../../lib/count-up.js';

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

// useLayoutEffect warns on the server; the swap to 0 must still land before
// the first painted frame on the client, or the final value flashes.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Counts from 0 to `value` once, the first time it is in view.
 *
 * Server markup and the no-JS / reduced-motion state are the final value. The
 * visible digits sit over an invisible copy of the final text, so the box has
 * its final width from the start and nothing shifts. Screen readers get the
 * final value only.
 */
export default function CountUp({
  value,
  prefix = '',
  suffix = '',
  durationMs = 900,
  className,
}: CountUpProps) {
  const liveRef = useRef<HTMLSpanElement>(null);
  const final = formatCount(value, prefix, suffix);

  useIsoLayoutEffect(() => {
    const live = liveRef.current;
    if (!live) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    live.textContent = formatCount(0, prefix, suffix);
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        live.textContent = formatCount(countAt(value, progress), prefix, suffix);
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        run();
      },
      { threshold: 0.6 }
    );
    observer.observe(live);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      live.textContent = final;
    };
  }, [value, prefix, suffix, durationMs, final]);

  return (
    <span className={['inline-grid tabular-nums', className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className="invisible [grid-area:1/1]">
        {final}
      </span>
      <span ref={liveRef} aria-hidden="true" className="[grid-area:1/1] justify-self-end">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
