// @vitest-environment node
/**
 * TDD RED → GREEN — Header.astro component tests.
 *
 * Uses Astro Container API with React renderer registered (Header includes
 * HeaderScrollState client:load island).
 *
 * Tests:
 * 1. Renders without crash
 * 2. Brand "jcsoftdev" is present in output (font-mono)
 * 3. Portfolio nav link is present
 * 4. Blog nav link is present
 * 5. header element is present (sticky shell)
 * 6. header-sentinel div is present
 */

import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/react';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

async function createContainerWithReact() {
  const renderers = await loadRenderers([getContainerRenderer()]);
  return AstroContainer.create({ renderers });
}

describe('Header', () => {
  it('renders without crash', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toBeTruthy();
  });

  it('renders brand text "jcsoftdev"', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toContain('jcsoftdev');
  });

  it('renders Portfolio nav link', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toContain('href="/portfolio"');
    expect(result).toContain('Portfolio');
  });

  it('renders Blog nav link', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toContain('href="/blog"');
    expect(result).toContain('Blog');
  });

  it('contains a <header> element', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toContain('<header');
  });

  it('contains the header-sentinel element', async () => {
    const { default: Header } = await import('./Header.astro');
    const container = await createContainerWithReact();
    const result = await container.renderToString(Header);
    expect(result).toContain('id="header-sentinel"');
  });
});
