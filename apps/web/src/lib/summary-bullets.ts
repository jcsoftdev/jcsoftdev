/** Bullets shown before the rest collapse behind a "+N more" toggle. */
export const VISIBLE_BULLETS = 2;

/** Roles beyond this many oldest ones start collapsed. */
const COLLAPSED_OLDEST = 3;

export interface SplitSummary {
  /** Everything before the first list, as sanitized HTML. */
  intro: string;
  /** Inner HTML of each <li>, in order. */
  bullets: string[];
}

/**
 * Splits a sanitized summary into its lead-in and list items.
 *
 * The input is already sanitized server-side (ADR-14) and the list is flat, so
 * a pattern match is enough and keeps the split usable during SSR with no DOM.
 * A summary without a list comes back as intro only.
 */
export function splitSummary(html: string | null): SplitSummary {
  if (!html) return { intro: '', bullets: [] };

  const bullets = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => (m[1] ?? '').trim());
  const listStart = html.search(/<ul[\s>]/);
  const intro = (listStart === -1 ? html : html.slice(0, listStart)).trim();

  return { intro, bullets };
}

/**
 * Indexes of roles that start expanded, given roles sorted newest first.
 *
 * The three oldest roles start collapsed; the newest always starts expanded.
 */
export function defaultExpandedIndexes(count: number): number[] {
  const keep = Math.max(1, count - COLLAPSED_OLDEST);
  return Array.from({ length: Math.min(keep, count) }, (_, i) => i);
}
