export const WORDS_PER_MINUTE = 200;

/** Visible text of an HTML string: tags dropped, code kept, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  return text ? text.split(' ').filter(Boolean).length : 0;
}

/** Whole minutes to read the HTML at ~200 wpm; never below 1. */
export function readingTimeMinutes(html: string, wpm = WORDS_PER_MINUTE): number {
  const words = countWords(htmlToText(html));
  return Math.max(1, Math.ceil(words / wpm));
}
