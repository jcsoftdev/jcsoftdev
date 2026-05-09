// @vitest-environment node
/**
 * TDD RED → GREEN — Link.astro component tests.
 *
 * Tests:
 * 1. Internal href → no target/rel, no external icon
 * 2. External https:// href → target="_blank" and rel="noopener noreferrer"
 * 3. External href → contains external icon marker
 * 4. Slot content renders
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

describe('Link', () => {
  it('internal href has no target or rel attributes', async () => {
    const { default: Link } = await import('./Link.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Link, {
      props: { href: '/blog' },
      slots: { default: 'Blog' },
    });
    expect(result).toContain('href="/blog"');
    expect(result).not.toContain('target="_blank"');
    expect(result).not.toContain('rel="noopener noreferrer"');
  });

  it('external https:// href gets target="_blank" and rel="noopener noreferrer"', async () => {
    const { default: Link } = await import('./Link.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Link, {
      props: { href: 'https://github.com' },
      slots: { default: 'GitHub' },
    });
    expect(result).toContain('target="_blank"');
    expect(result).toContain('noopener noreferrer');
  });

  it('external href contains external icon SVG', async () => {
    const { default: Link } = await import('./Link.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Link, {
      props: { href: 'https://github.com' },
      slots: { default: 'GitHub' },
    });
    expect(result).toContain('<svg');
  });

  it('internal href has no external icon', async () => {
    const { default: Link } = await import('./Link.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Link, {
      props: { href: '/portfolio' },
      slots: { default: 'Portfolio' },
    });
    expect(result).not.toContain('<svg');
  });

  it('renders slot content', async () => {
    const { default: Link } = await import('./Link.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Link, {
      props: { href: '/blog' },
      slots: { default: 'Read the blog' },
    });
    expect(result).toContain('Read the blog');
  });
});
