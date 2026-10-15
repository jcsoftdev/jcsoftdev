import { describe, expect, it } from 'vitest';
import { staggerDelay } from './stagger.js';

describe('staggerDelay', () => {
  it('steps by 60ms from the first row', () => {
    expect([0, 1, 2].map((i) => staggerDelay(i))).toEqual([0, 60, 120]);
  });

  it('caps long batches and ignores negative indexes', () => {
    expect(staggerDelay(50)).toBe(600);
    expect(staggerDelay(-3)).toBe(0);
  });
});
