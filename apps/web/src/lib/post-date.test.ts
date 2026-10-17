import { describe, expect, it } from 'vitest';
import { formatPostDate, postNumeral } from './post-date';

describe('formatPostDate', () => {
  it('formats in UTC regardless of the local zone', () => {
    expect(formatPostDate('2026-10-16T23:30:00.000Z')).toBe('October 16, 2026');
  });

  it('returns null for missing or invalid input', () => {
    expect(formatPostDate(null)).toBeNull();
    expect(formatPostDate('nope')).toBeNull();
  });
});

describe('postNumeral', () => {
  it('pads to two digits', () => {
    expect(postNumeral(1)).toBe('01');
    expect(postNumeral(12)).toBe('12');
  });
});
