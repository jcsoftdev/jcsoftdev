/**
 * Minimal killable timeline interface.
 * Matches the GSAP Timeline surface used downstream (kill is the only required method for cleanup).
 */
export interface KillableTimeline {
  kill(): void;
}

/**
 * No-op timeline returned when prefers-reduced-motion: reduce is active or
 * when running in an SSR context (no window).
 */
export interface NoOpTimeline extends KillableTimeline {
  kill(): void;
}

/**
 * A factory that accepts an Element and returns a KillableTimeline.
 */
export type TimelineFactory<T extends KillableTimeline = KillableTimeline> = (root: Element) => T;

/**
 * Higher-order function that wraps a timeline factory with reduced-motion safety.
 *
 * Rules (V1 — static at mount, not reactive to mid-session media-query changes):
 * - If typeof window === 'undefined' (SSR/Node): returns NoOpTimeline
 * - If window.matchMedia('(prefers-reduced-motion: reduce)').matches: returns NoOpTimeline
 * - Otherwise: delegates to the original factory unchanged
 *
 * The returned factory has the same call signature as the original but returns
 * KillableTimeline | NoOpTimeline (both satisfy KillableTimeline).
 *
 * @param factory - The original timeline factory to wrap
 * @returns A reduced-motion-safe version of the factory
 */
export function createReducedMotionSafe<T extends KillableTimeline>(
  factory: TimelineFactory<T>
): TimelineFactory<T | NoOpTimeline> {
  return (root: Element): T | NoOpTimeline => {
    if (typeof window === 'undefined') {
      return { kill() {} };
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { kill() {} };
    }

    return factory(root);
  };
}
