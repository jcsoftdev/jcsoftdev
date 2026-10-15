export const STAGGER_STEP_MS = 60;
export const STAGGER_MAX_STEPS = 10;

/** Delay for the nth row of one reveal batch; capped so a long list never waits. */
export function staggerDelay(
  index: number,
  step = STAGGER_STEP_MS,
  maxSteps = STAGGER_MAX_STEPS
): number {
  return Math.min(Math.max(index, 0), maxSteps) * step;
}
