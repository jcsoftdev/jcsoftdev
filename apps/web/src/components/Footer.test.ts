// @vitest-environment node
/**
 * Footer.astro — Astro Container API tests.
 *
 * The footer used to be a four-column sitemap: brand, tagline, navigation,
 * socials and a stack list. SideRail now carries navigation, socials and the
 * email at every scroll position, so repeating them here was chrome the reader
 * could already see. What is left is what a rail cannot say.
 *
 * Assertions deliberately avoid bare 'jcsoftdev' and 'Footer': Astro stamps
 * data-astro-source-file with the absolute path, which contains both, so those
 * strings pass whatever the component renders.
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

async function render(): Promise<string> {
  const { default: Footer } = await import('./Footer.astro');
  const container = await AstroContainer.create();
  return container.renderToString(Footer);
}

describe('Footer', () => {
  it('renders without crash', async () => {
    expect(await render()).toBeTruthy();
  });

  it('renders the copyright with the current year', async () => {
    const result = await render();
    expect(result).toContain(String(new Date().getFullYear()));
    expect(result).toContain('Juan Carlos Valencia');
  });

  it('renders the built-with list', async () => {
    const result = await render();
    for (const tech of ['Astro 5', 'Hono', 'Drizzle', 'React 19', 'Tailwind v4']) {
      expect(result).toContain(tech);
    }
  });

  it('links back to the top of the content column', async () => {
    // #content is the wrapper RootLayout puts beside the rail — not the page
    // top, which on lg+ is behind the fixed rail.
    expect(await render()).toContain('href="#content"');
  });

  it('does not repeat the navigation the rail already carries', async () => {
    const result = await render();
    expect(result).not.toContain('href="/#work"');
    expect(result).not.toContain('href="/#experience"');
    expect(result).not.toContain('href="mailto:');
    expect(result).not.toContain('github.com/');
    expect(result).not.toContain('linkedin.com/');
  });
});
