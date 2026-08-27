// @vitest-environment node
/**
 * SideRail.astro — Astro Container API tests.
 *
 * This covers what moved out of Footer.astro and Header.astro when the top bar
 * became a rail: navigation, socials, the email, and the status readout a top
 * bar had nowhere to put.
 *
 * Assertions avoid bare 'jcsoftdev' and 'SideRail': Astro stamps
 * data-astro-source-file with the absolute path, which contains both — in CI
 * the path is /home/runner/work/jcsoftdev/jcsoftdev/..., so 'jcsoftdev' passes
 * against any markup at all.
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

async function render(pathname = '/'): Promise<string> {
  const { default: SideRail } = await import('./SideRail.astro');
  const container = await AstroContainer.create();
  return container.renderToString(SideRail, {
    request: new Request(`https://jcsoftdev.com${pathname}`),
  });
}

describe('SideRail', () => {
  it('renders without crash', async () => {
    expect(await render()).toBeTruthy();
  });

  it('renders every section and route link', async () => {
    const result = await render();
    for (const href of ['/#work', '/#experience', '/#about', '/blog', '/resume']) {
      expect(result).toContain(`href="${href}"`);
    }
  });

  it('renders the status readout a top bar had no room for', async () => {
    const result = await render();
    expect(result).toContain('Lima · UTC-5');
    expect(result).toContain('Under 24h');
    expect(result).toContain('2017');
  });

  it('renders the email and socials', async () => {
    const result = await render();
    expect(result).toContain('mailto:hello@jcsoftdev.com');
    expect(result).toContain('github.com/jcsoftdev');
    expect(result).toContain('linkedin.com/in/jcsoftdev');
  });

  it('marks the current route with aria-current', async () => {
    const result = await render('/blog');
    expect(result).toMatch(
      /href="\/blog"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/blog"/
    );
  });

  it('renders the mobile drawer and its toggle', async () => {
    const result = await render();
    expect(result).toContain('data-rail-toggle');
    expect(result).toContain('data-rail-drawer');
    expect(result).toContain('aria-controls="rail-drawer"');
  });

  it('tags section links for the scroll spy', async () => {
    // The rail doubles as a position indicator; these hooks are what the
    // IntersectionObserver binds to.
    const result = await render();
    for (const id of ['work', 'experience', 'about']) {
      expect(result).toContain(`data-rail-section="${id}"`);
    }
  });
});
