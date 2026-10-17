import { describe, expect, it } from 'vitest';
import { countWords, htmlToText, readingTimeMinutes } from './reading-time';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

describe('htmlToText', () => {
  it('drops tags, scripts and collapses whitespace', () => {
    expect(htmlToText('<p>Hello <strong>big</strong>\n world</p><script>x()</script>')).toBe(
      'Hello big world'
    );
  });
});

describe('countWords', () => {
  it('returns 0 for empty text', () => {
    expect(countWords('')).toBe(0);
  });
});

describe('readingTimeMinutes', () => {
  it('is at least 1 minute, even for empty html', () => {
    expect(readingTimeMinutes('')).toBe(1);
    expect(readingTimeMinutes('<p>short</p>')).toBe(1);
  });

  it('rounds up at 200 wpm', () => {
    expect(readingTimeMinutes(`<p>${words(200)}</p>`)).toBe(1);
    expect(readingTimeMinutes(`<p>${words(201)}</p>`)).toBe(2);
    expect(readingTimeMinutes(`<p>${words(1000)}</p>`)).toBe(5);
  });

  it('does not count markup as words', () => {
    expect(readingTimeMinutes(`<p class="a b c">${words(200)}</p>`)).toBe(1);
  });
});
