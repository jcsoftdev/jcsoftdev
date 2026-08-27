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

  // --- C2 (Critical RCE) regression tests ---
  // The old engine compiled with outputFormat:'function-body' and executed the
  // result via run()/Function — so an MDX {} expression ran server-side. These
  // tests prove user {} expressions are NEVER evaluated by the new AST renderer.

  it('does NOT evaluate {process.env.X} — server secrets never leak', async () => {
    process.env.MDXRCESECRET = 'TOP-SECRET-VALUE-DO-NOT-LEAK';
    try {
      const source = 'Payload: {process.env.MDXRCESECRET}';
      const result = await compileMdx(source);

      // Whether rejected or rendered, the secret value must never appear.
      if (result.ok) {
        expect(result.html).not.toContain('TOP-SECRET-VALUE-DO-NOT-LEAK');
        // The expression is rendered inert, as literal text (never evaluated).
        expect(result.html).toContain('process.env.MDXRCESECRET');
      } else {
        expect(result.error.length).toBeGreaterThan(0);
      }
    } finally {
      delete process.env.MDXRCESECRET;
    }
  });

  it('does NOT execute {await import("node:child_process")} injection', async () => {
    const source = "Danger: {await import('node:child_process')}";
    const result = await compileMdx(source);

    // Must not throw, must not execute. Either inert text or a clean error.
    if (result.ok) {
      // Rendered inert as literal text — no execution, no module loaded.
      expect(result.html).toContain('node:child_process');
      expect(result.html).not.toContain('node_modules');
    } else {
      expect(typeof result.error).toBe('string');
    }
  });

  it('does NOT evaluate a global-mutating expression', async () => {
    const marker = '__mdx_rce_executed__';
    // If this expression were executed, it would set a global flag.
    const source = `{(globalThis.${marker} = true)}`;
    const result = await compileMdx(source);

    // The expression must not have run.
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined();
    if (result.ok) {
      expect(result.html.length).toBeGreaterThan(0);
    }
  });

  it('renders GFM (tables, strikethrough, task lists, autolinks)', async () => {
    const source = [
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '~~struck~~',
      '',
      '- [x] done',
      '- [ ] todo',
      '',
      'Visit https://example.com now.',
    ].join('\n');

    const result = await compileMdx(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('<table>');
    expect(result.html).toContain('<del>');
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain('<a href="https://example.com"');
  });
  describe('guards ignore code regions', () => {
    // Regression: the PascalCase and blocked-element guards ran against the raw
    // source, so a post that merely DOCUMENTED markup was rejected in full and
    // rendered as "Content failed to render." On a developer's blog — where
    // fenced JSX and <script> examples are the whole point — that is the common
    // case, not the edge case.

    it('allows a PascalCase component inside a fenced code block', async () => {
      const source = ['# Using the Button', '', '```jsx', '<Button onClick={fn} />', '```'].join(
        '\n'
      );

      const result = await compileMdx(source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.html).toContain('<code');
      expect(result.html).toContain('&#x3C;Button');
    });

    it('allows a blocked element inside a fenced code block', async () => {
      const source = ['Never do this:', '', '```html', '<script>alert(1)</script>', '```'].join(
        '\n'
      );

      const result = await compileMdx(source);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.html).toContain('&#x3C;script>');
    });

    it('allows a PascalCase reference inside an inline code span', async () => {
      const result = await compileMdx('Render the `<Card />` component.');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.html).toContain('<code>');
    });

    it('allows a tilde-fenced block and an indented code block', async () => {
      const source = ['~~~tsx', '<Widget />', '~~~', '', '    <Legacy />'].join('\n');
      const result = await compileMdx(source);
      expect(result.ok).toBe(true);
    });

    it('still rejects a PascalCase component used OUTSIDE a code block', async () => {
      const source = ['```jsx', '<Button />', '```', '', '<Button />'].join('\n');
      const result = await compileMdx(source);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/not allowed/i);
    });

    it('still rejects a blocked element used OUTSIDE a code block', async () => {
      const source = ['```html', '<script>ok</script>', '```', '', '<script>real</script>'].join(
        '\n'
      );
      const result = await compileMdx(source);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/blocked element/i);
    });
  });
});
