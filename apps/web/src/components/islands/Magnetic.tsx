/**
 * Magnetic — wraps a child element with cursor-attraction effect.
 *
 * onMouseMove: translates the child toward the cursor with eased lerp.
 * onMouseLeave: springs back to origin.
 * Reduced-motion / coarse pointer: no-op.
 */

import { type ReactNode, useEffect, useRef } from 'react';

interface MagneticProps {
  children: ReactNode;
  /** Strength of the pull (0–1). Default 0.35. */
  strength?: number;
}

export default function Magnetic({ children, strength = 0.35 }: MagneticProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse) return;

    let raf = 0;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      target.x = (e.clientX - cx) * strength;
      target.y = (e.clientY - cy) * strength;
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    const tick = () => {
      current.x += (target.x - current.x) * 0.18;
      current.y += (target.y - current.y) * 0.18;
      el.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
    };
  }, [strength]);

  return (
    <div ref={wrapRef} style={{ display: 'inline-block', willChange: 'transform' }}>
      {children}
    </div>
  );
}
