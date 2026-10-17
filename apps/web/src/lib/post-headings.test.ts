import { describe, expect, it } from 'vitest';
import { addHeadingIds, slugify } from './post-headings';

describe('slugify', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(slugify('Hello, Wörld & Co.')).toBe('hello-world-co');
  });

  it('falls back when nothing is left', () => {
    expect(slugify('???')).toBe('section');
  });
});

describe('addHeadingIds', () => {
  it('adds ids to h2/h3 and builds the outline', () => {
    const { html, toc } = addHeadingIds(
      '<h2>Intro</h2><p>x</p><h3>Deep <em>dive</em></h3><h1>Top</h1>'
    );
    expect(html).toBe(
      '<h2 id="intro">Intro</h2><p>x</p><h3 id="deep-dive">Deep <em>dive</em></h3><h1>Top</h1>'
    );
    expect(toc).toEqual([
      { id: 'intro', text: 'Intro', level: 2 },
      { id: 'deep-dive', text: 'Deep dive', level: 3 },
    ]);
  });

  it('dedupes repeated headings', () => {
    const { toc } = addHeadingIds('<h2>Setup</h2><h2>Setup</h2><h3>Setup</h3>');
    expect(toc.map((t) => t.id)).toEqual(['setup', 'setup-2', 'setup-3']);
  });

  it('keeps an existing safe id and preserves other attributes', () => {
    const { html, toc } = addHeadingIds('<h2 class="a" id="mine">Hi</h2>');
    expect(html).toBe('<h2 class="a" id="mine">Hi</h2>');
    expect(toc[0]?.id).toBe('mine');
  });

  it('replaces an unsafe existing id instead of trusting it', () => {
    const { html } = addHeadingIds('<h2 id="x&quot; onclick=&quot;y">Hi</h2>');
    expect(html).toBe('<h2 id="hi">Hi</h2>');
  });

  it('skips empty headings and decodes entities in toc text', () => {
    const { html, toc } = addHeadingIds('<h2></h2><h2>Q &amp; A</h2>');
    expect(html).toBe('<h2></h2><h2 id="q-a">Q &amp; A</h2>');
    expect(toc).toEqual([{ id: 'q-a', text: 'Q & A', level: 2 }]);
  });

  it('returns the html untouched when there are no headings', () => {
    const src = '<p>plain</p>';
    expect(addHeadingIds(src)).toEqual({ html: src, toc: [] });
  });
});
