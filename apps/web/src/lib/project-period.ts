function yearOf(iso: string | null): string | null {
  return iso ? iso.slice(0, 4) : null;
}

/**
 * "2026", "2023 — 2024" or "2026 — now". Null when the project has no start date.
 */
export function projectPeriod(startedAt: string | null, endedAt: string | null): string | null {
  const from = yearOf(startedAt);
  if (!from) return null;
  if (!endedAt) return `${from} — now`;
  const to = yearOf(endedAt);
  return to === from ? from : `${from} — ${to}`;
}
