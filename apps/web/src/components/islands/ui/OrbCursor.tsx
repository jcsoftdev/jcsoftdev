import { useEffect, useRef } from 'react';

/**
 * OrbCursor — mouse-tracked cursor orb with delayed lerp.
 *
 * - lerp factor: 0.08 (smooth follow)
 * - skips on (pointer: coarse) — touch/mobile devices
 * - skips on (prefers-reduced-motion: reduce)
 * - cleanup removes pointermove listener on unmount
 */
export default function OrbCursor() {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer =
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(pointer:coarse)').matches;

    if (reducedMotion || coarsePointer) {
      return;
    }

    const orb = orbRef.current;
    if (!orb) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId: number;

    const handlePointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      const LERP = 0.08;
      currentX += (targetX - currentX) * LERP;
      currentY += (targetY - currentY) * LERP;

      orb.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handlePointerMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={orbRef}
      aria-hidden="true"
      data-cursor-orb
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '40vmax',
        height: '40vmax',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 'var(--z-orbs)' as string,
        background: 'radial-gradient(circle, oklch(1 0 0 / 0.06) 0%, transparent 55%)',
        filter: 'blur(60px)',
        opacity: 0.4,
        willChange: 'transform',
      }}
    />
  );
}
