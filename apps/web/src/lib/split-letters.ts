export interface SplitChar {
  char: string;
  /** Position across the whole heading; drives the reveal stagger. */
  index: number;
}

export interface SplitWord {
  chars: SplitChar[];
  /** True from `accentFrom` (a word index) onward. */
  accent: boolean;
}

/** Splits a heading into words of indexed characters for the letter-mask reveal. */
export function splitLetters(text: string, accentFrom = Number.POSITIVE_INFINITY): SplitWord[] {
  let index = 0;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, wordIndex) => ({
      accent: wordIndex >= accentFrom,
      chars: [...word].map((char) => ({ char, index: index++ })),
    }));
}
