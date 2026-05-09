/**
 * Cursor encode/decode utilities for cursor-based pagination.
 *
 * The cursor is a base64url-encoded ISO date string (createdAt of the last item).
 * This gives stable pagination ordered by `created_at DESC`.
 *
 * Format: base64url(isoDateString)
 * Example: encodeCursor(new Date('2026-01-15T10:30:00Z')) → "MjAyNi0wMS0xNVQxMDozMDowMC4wMDBa"
 */

/**
 * Encode a Date into a URL-safe base64 cursor string.
 */
export function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString()).toString('base64url');
}

/**
 * Decode a cursor string back to a Date.
 *
 * Returns null on any of:
 * - null/undefined input
 * - Invalid base64url
 * - Decoded string is not a valid date
 */
export function decodeCursor(cursor: string | null | undefined): Date | null {
  if (!cursor) return null;

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const date = new Date(decoded);
    if (Number.isNaN(date.getTime())) return null;
    // Verify round-trip — guards against base64 noise that happens to decode to something
    if (date.toISOString() !== decoded) return null;
    return date;
  } catch {
    return null;
  }
}
