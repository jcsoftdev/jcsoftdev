import { describe, expect, it } from 'vitest';
import { defaultExpandedIndexes, splitSummary } from './summary-bullets.js';

describe('splitSummary', () => {
  it('separates the lead-in from the list items', () => {
    const { intro, bullets } = splitSummary(
      '<p>Lead.</p>\n<ul>\n<li>One <strong>bold</strong></li>\n<li>Two</li>\n</ul>'
    );
    expect(intro).toBe('<p>Lead.</p>');
    expect(bullets).toEqual(['One <strong>bold</strong>', 'Two']);
  });

  it('returns intro only when there is no list', () => {
    expect(splitSummary('<p>Just text.</p>')).toEqual({
      intro: '<p>Just text.</p>',
      bullets: [],
    });
  });

  it('handles null', () => {
    expect(splitSummary(null)).toEqual({ intro: '', bullets: [] });
  });
});

describe('defaultExpandedIndexes', () => {
  it('collapses the three oldest of five roles', () => {
    expect(defaultExpandedIndexes(5)).toEqual([0, 1]);
  });

  it('always keeps the newest role expanded', () => {
    expect(defaultExpandedIndexes(3)).toEqual([0]);
    expect(defaultExpandedIndexes(1)).toEqual([0]);
  });

  it('expands nothing for an empty list', () => {
    expect(defaultExpandedIndexes(0)).toEqual([]);
  });
});
