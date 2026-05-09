// @vitest-environment node
/**
 * TDD RED → GREEN — Footer.astro component tests.
 *
 * Tests (Astro Container API — node environment):
 * 1. Renders without crash
 * 2. Brand "jcsoftdev" is present
 * 3. Tagline text is present
 * 4. Portfolio nav link is present
 * 5. Blog nav link is present
 * 6. GitHub social link is present (SVG icon + href)
 * 7. LinkedIn social link is present
 * 8. Email social link is present
 * 9. Copyright text is present
 * 10. Stack pills (Astro, Hono, Drizzle, React) are present
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

describe('Footer', () => {
  it('renders without crash', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toBeTruthy();
  });

  it('renders brand text "jcsoftdev"', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('jcsoftdev');
  });

  it('renders tagline text', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('Engineering blog and portfolio');
  });

  it('renders Portfolio nav link', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('href="/portfolio"');
  });

  it('renders Blog nav link', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('href="/blog"');
  });

  it('renders GitHub social link with SVG icon', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('github.com');
    expect(result).toContain('<svg');
  });

  it('renders LinkedIn social link', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('linkedin.com');
  });

  it('renders Email social link', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('mailto:');
  });

  it('renders copyright text', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('2026');
    expect(result).toContain('Juan Carlos Valencia');
  });

  it('renders stack pills (Astro, Hono, Drizzle, React)', async () => {
    const { default: Footer } = await import('./Footer.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Footer);
    expect(result).toContain('Astro');
    expect(result).toContain('Hono');
    expect(result).toContain('Drizzle');
    expect(result).toContain('React');
  });
});
