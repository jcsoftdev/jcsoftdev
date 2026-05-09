// @vitest-environment node
/**
 * TDD RED → GREEN — Button.astro component tests.
 *
 * Tests:
 * 1. Renders <a> when href prop is provided
 * 2. Renders <button> when no href
 * 3. Primary variant contains accent class marker
 * 4. Ghost variant contains ghost class marker
 * 5. Link variant contains link class marker
 * 6. md and lg sizes reflected in output
 * 7. Renders without crash for all variants
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

describe('Button', () => {
  it('renders <a> when href is provided', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { href: '/portfolio', variant: 'primary', size: 'md' },
      slots: { default: 'View Portfolio' },
    });
    expect(result).toContain('<a');
    expect(result).toContain('href="/portfolio"');
    expect(result).not.toMatch(/<button/);
  });

  it('renders <button> when no href is provided', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'primary', size: 'md' },
      slots: { default: 'Click me' },
    });
    expect(result).toContain('<button');
    expect(result).not.toMatch(/href=/);
  });

  it('primary variant has accent-related class', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'primary', size: 'md' },
      slots: { default: 'Primary' },
    });
    expect(result).toContain('primary');
  });

  it('ghost variant has ghost-related class', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'ghost', size: 'md' },
      slots: { default: 'Ghost' },
    });
    expect(result).toContain('ghost');
  });

  it('link variant has link-related class', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'link', size: 'md' },
      slots: { default: 'Link' },
    });
    expect(result).toContain('link');
  });

  it('lg size reflected in output', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'primary', size: 'lg' },
      slots: { default: 'Large' },
    });
    expect(result).toContain('lg');
  });

  it('renders slot content', async () => {
    const { default: Button } = await import('./Button.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Button, {
      props: { variant: 'ghost', size: 'md' },
      slots: { default: 'Read Blog' },
    });
    expect(result).toContain('Read Blog');
  });
});
