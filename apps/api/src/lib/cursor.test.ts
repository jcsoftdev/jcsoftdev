/**
 * TDD RED — Cursor encode/decode utilities
 */
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a date cursor', () => {
    const date = new Date('2026-01-15T10:30:00.000Z');
    const encoded = encodeCursor(date);
    expect(typeof encoded).toBe('string');

    const decoded = decodeCursor(encoded);
    expect(decoded).toBeInstanceOf(Date);
    expect(decoded?.getTime()).toBe(date.getTime());
  });

  it('returns null for null input', () => {
    const result = decodeCursor(null);
    expect(result).toBeNull();
  });

  it('returns null for undefined input', () => {
    const result = decodeCursor(undefined);
    expect(result).toBeNull();
  });

  it('returns null for invalid base64', () => {
    const result = decodeCursor('!!!not-valid-base64!!!');
    expect(result).toBeNull();
  });

  it('returns null for valid base64 but invalid date', () => {
    const encoded = Buffer.from('not-a-date').toString('base64url');
    const result = decodeCursor(encoded);
    expect(result).toBeNull();
  });

  it('produces url-safe base64 (no + / = chars)', () => {
    const date = new Date('2026-05-06T12:00:00.000Z');
    const encoded = encodeCursor(date);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
