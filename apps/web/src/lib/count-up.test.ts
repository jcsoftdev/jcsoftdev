import { describe, expect, it } from 'vitest';
import { countAt, easeOutExpo, formatCount } from './count-up.js';

describe('easeOutExpo', () => {
  it('is clamped at both ends', () => {
    expect(easeOutExpo(-1)).toBe(0);
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(2)).toBe(1);
  });

  it('front-loads progress and never decreases', () => {
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.9);
    let prev = 0;
    for (let i = 1; i <= 10; i++) {
      const v = easeOutExpo(i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('countAt', () => {
  it('starts at 0 and lands exactly on the target', () => {
    expect(countAt(2017, 0)).toBe(0);
    expect(countAt(2017, 1)).toBe(2017);
    expect(countAt(76, 1)).toBe(76);
  });
});

describe('formatCount', () => {
  it('wraps the value in prefix and suffix', () => {
    expect(formatCount(80, '', '%+')).toBe('80%+');
    expect(formatCount(8, '', '+')).toBe('8+');
    expect(formatCount(2017)).toBe('2017');
  });
});
