/**
 * gradient-from-slug.ts
 *
 * Pure, deterministic conic-gradient generator for project slug strings.
 * Algorithm: char-code polynomial hash → angle (0–359) + two hue offsets
 * within the violet family (260–300). No Math.random(). Stable across
 * all environments and builds (REQ-GRAD-3).
 */

/** Violet-family hue anchors (OKLCH H channel, degrees). */
const VIOLET_HUES = [275, 280, 285, 290, 270, 295, 265, 300] as const;

/**
 * Compute a 32-bit unsigned integer hash from a string using a
 * classic polynomial rolling hash (base-31, modular). Deterministic.
 */
function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (Math.imul(hash, 31) + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Generate a deterministic `conic-gradient()` CSS string from a project slug.
 *
 * @param slug - The project slug string (e.g. "design-system-immersive")
 * @returns A valid CSS `conic-gradient()` value string with violet OKLCH stops
 *
 * @example
 * gradientFromSlug('my-project')
 * // → "conic-gradient(from 123deg at 50% 50%, oklch(0.45 0.18 280) 0deg, ...)"
 */
export function gradientFromSlug(slug: string): string {
  const hash = hashSlug(slug);

  // Angle: full 0–359 range
  const angle = hash % 360;

  // Primary hue: pick from violet family
  const h1 = VIOLET_HUES[hash % VIOLET_HUES.length];

  // Secondary hue: pick from a shifted position in the violet family
  const h2 = VIOLET_HUES[((hash >>> 4) + 2) % VIOLET_HUES.length];

  // Tertiary hue: step +20 within violet family (stays in 260–310 range)
  const h3 = VIOLET_HUES[((hash >>> 8) + 4) % VIOLET_HUES.length];

  return (
    `conic-gradient(from ${angle}deg at 50% 50%, ` +
    `oklch(0.45 0.18 ${h1}) 0deg, ` +
    `oklch(0.30 0.14 ${h2}) 120deg, ` +
    `oklch(0.10 0 0) 200deg, ` +
    `oklch(0.35 0.16 ${h3}) 320deg, ` +
    `oklch(0.45 0.18 ${h1}) 360deg)`
  );
}
