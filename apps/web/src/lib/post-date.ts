/** "October 16, 2026". UTC so the day never shifts with the server's zone. */
export function formatPostDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Two-digit list numeral: 1 -> "01". */
export function postNumeral(position: number): string {
  return String(position).padStart(2, '0');
}
