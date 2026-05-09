/**
 * TDD RED — Markdown sanitizer tests
 *
 * sanitizeMarkdown(input): string
 *   - XSS payloads blocked: <script>, <img onerror>, javascript: href
 *   - Valid markdown rendered: headings, bold, links, lists, code
 *   - Empty / null input → empty string (no error)
 *   - Raw HTML in input: safe tags preserved, unsafe stripped
 *
 * Design §11: marked (GFM) + isomorphic-dompurify; server-side sanitize at
 * API serialization time. Cached payload stores sanitized HTML.
 */

import { describe, expect, it } from 'vitest';
import { sanitizeMarkdown } from './markdown.js';

describe('sanitizeMarkdown — XSS blocking', () => {
  it('strips <script> tags from input', () => {
    const input = 'Hello <script>alert(1)</script> world';
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('alert(1)');
  });

  it('strips <img onerror> from input', () => {
    const input = '<img src="x" onerror="alert(1)" />';
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('alert(1)');
  });

  it('strips javascript: hrefs', () => {
    const input = '[click me](javascript:alert(1))';
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain('javascript:');
  });

  it('strips on* event handlers on arbitrary elements', () => {
    const input = '<div onclick="evil()">safe text</div>';
    const output = sanitizeMarkdown(input);
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('evil()');
  });
});

describe('sanitizeMarkdown — valid markdown rendered', () => {
  it('renders headings', () => {
    const output = sanitizeMarkdown('## Hello\n\nWorld');
    expect(output).toContain('<h2');
    expect(output).toContain('Hello');
    expect(output).toContain('<p>');
  });

  it('renders bold/strong', () => {
    const output = sanitizeMarkdown('**bold text**');
    expect(output).toContain('<strong>');
    expect(output).toContain('bold text');
  });

  it('renders links (safe hrefs preserved)', () => {
    const output = sanitizeMarkdown('[visit](https://example.com)');
    expect(output).toContain('href="https://example.com"');
  });

  it('renders unordered lists', () => {
    const output = sanitizeMarkdown('- item one\n- item two');
    expect(output).toContain('<ul>');
    expect(output).toContain('<li>');
  });

  it('renders inline code', () => {
    const output = sanitizeMarkdown('use `const x = 1`');
    expect(output).toContain('<code>');
  });

  it('renders fenced code blocks', () => {
    const output = sanitizeMarkdown('```js\nconst x = 1;\n```');
    // Marked wraps fenced code in <pre><code class="language-js">
    expect(output).toContain('<code');
    expect(output).toContain('const x = 1');
  });
});

describe('sanitizeMarkdown — edge cases', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeMarkdown('')).toBe('');
  });

  it('does not throw for plain text without markdown', () => {
    const output = sanitizeMarkdown('Just some plain text with no markdown.');
    expect(output).toContain('Just some plain text');
  });
});
