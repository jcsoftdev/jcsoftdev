/** easeOutExpo: fast start, long soft landing. Clamped to [0, 1]. */
export function easeOutExpo(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - 2 ** (-10 * t);
}

/** Integer shown at `progress` (0..1) of a count towards `target`. */
export function countAt(target: number, progress: number): number {
  return Math.round(target * easeOutExpo(progress));
}

/** Text for a counted value, e.g. `80%+` from (80, '', '%+'). */
export function formatCount(value: number, prefix = '', suffix = ''): string {
  return `${prefix}${value}${suffix}`;
}
