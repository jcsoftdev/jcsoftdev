import { createReducedMotionSafe } from '../reduced-motion.js';

/**
 * Raw cursor-orb animation factory.
 *
 * Tracks the cursor via pointermove + rAF lerp (factor 0.08).
 * Position is applied via transform: translate3d.
 *
 * Guards (checked before registering anything):
 * - pointer:coarse → no-op (touch/mobile devices)
 *
 * NOTE: The exported variant is pre-wrapped with createReducedMotionSafe.
 * The wrapper handles the SSR and prefers-reduced-motion guards.
 * This raw factory only needs to handle the coarse-pointer guard.
 *
 * @param orb - The orb HTMLElement to animate
 * @returns { kill() } — removes listener + cancels rAF on cleanup
 */
function _cursorOrbFactory(orb: Element): { kill(): void } {
  // Guard: coarse pointer (touch) — no cursor tracking
  if (
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(pointer:coarse)').matches)
  ) {
    return { kill() {} };
  }

  const el = orb as HTMLElement;

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;
  let rafId: number;

  const LERP = 0.08;

  const handlePointerMove = (e: PointerEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;
  };

  const tick = () => {
    currentX += (targetX - currentX) * LERP;
    currentY += (targetY - currentY) * LERP;

    el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

    rafId = window.requestAnimationFrame(tick);
  };

  window.addEventListener('pointermove', handlePointerMove);
  rafId = window.requestAnimationFrame(tick);

  return {
    kill() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.cancelAnimationFrame(rafId);
    },
  };
}

/**
 * Reduced-motion-safe cursor-orb animation factory.
 *
 * Returns a no-op when:
 * - SSR context (no window)
 * - prefers-reduced-motion: reduce
 * - pointer: coarse (handled inside _cursorOrbFactory)
 *
 * CLIENT-ONLY: call in useEffect / onMount.
 */
export const createCursorOrbTimeline = createReducedMotionSafe(_cursorOrbFactory);
