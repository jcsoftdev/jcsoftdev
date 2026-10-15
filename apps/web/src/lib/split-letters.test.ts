import { describe, expect, it } from 'vitest';
import { splitLetters } from './split-letters.js';

describe('splitLetters', () => {
  it('indexes characters continuously across words', () => {
    const words = splitLetters('Selected work');
    expect(words.map((w) => w.chars.map((c) => c.char).join(''))).toEqual(['Selected', 'work']);
    expect(words[0]?.chars[0]?.index).toBe(0);
    expect(words[1]?.chars[0]?.index).toBe(8);
    expect(words[1]?.chars.at(-1)?.index).toBe(11);
  });

  it('marks accent from the given word index', () => {
    const words = splitLetters('a b c d', 2);
    expect(words.map((w) => w.accent)).toEqual([false, false, true, true]);
  });

  it('collapses extra whitespace and has no accent by default', () => {
    const words = splitLetters('  one   two ');
    expect(words).toHaveLength(2);
    expect(words.some((w) => w.accent)).toBe(false);
  });
});
