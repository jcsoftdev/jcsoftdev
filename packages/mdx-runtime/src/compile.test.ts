import { describe, expect, it } from 'vitest';
import { compileMdx } from './compile.js';

describe('compileMdx', () => {
  it('compiles valid MDX to an HTML string', async () => {
    const source = '# Hello World\n\nThis is a paragraph.';
    const result = await compileMdx(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello World');
    expect(result.html).toContain('<p>');
    expect(result.html).toContain('This is a paragraph.');
  });

  it('returns an error object for malformed MDX — does not throw', async () => {
    // Unclosed JSX tag is invalid MDX
    const source = '# Broken\n\n<UnclosedTag';
    const result = await compileMdx(source);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('allows standard HTML elements (p, pre, code, headings)', async () => {
    const source = [
      '# Heading 1',
      '## Heading 2',
      '',
      'A paragraph with `inline code`.',
      '',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');

    const result = await compileMdx(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('<h2');
    expect(result.html).toContain('<code');
    expect(result.html).toContain('<pre');
  });

  it('blocks unsafe custom component references — returns error, not throw', async () => {
    // Custom PascalCase component not in allow-list
    const source = '# Hello\n\n<UnsafeWidget prop="value" />';
    const result = await compileMdx(source);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toContain('not allowed');
  });

  it('blocks script tags as unsafe components', async () => {
    // <script> as a raw JSX element is a custom component in MDX context
    const source = 'Hello\n\n<script>alert(1)</script>';
    const result = await compileMdx(source);

    // Either blocked or if rendered, must not contain raw script
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    } else {
      expect(result.html).not.toContain('<script>alert(1)</script>');
    }
  });

  it('returns error object with safe message on compile failure', async () => {
    const source = '<BrokenComponent unclosed';
    const result = await compileMdx(source);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Error message must be a safe string, not a raw stack trace or internal path
    expect(result.error).not.toContain('node_modules');
  });
});
