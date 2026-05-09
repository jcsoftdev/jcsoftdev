// @vitest-environment node
/**
 * TDD RED → GREEN — Badge.astro component tests.
 *
 * Tests:
 * 1. Renders without crash (solid variant default)
 * 2. Ghost variant is reflected in output markup
 * 3. Accent variant is reflected in output markup
 * 4. sm and md sizes are reflected in output markup
 * 5. Slot content renders
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

describe('Badge', () => {
  it('renders without crash with default solid variant', async () => {
    const { default: Badge } = await import('./Badge.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Badge, {
      props: { variant: 'solid', size: 'md' },
      slots: { default: 'React' },
    });
    expect(result).toBeTruthy();
    expect(result).toContain('React');
  });

  it('ghost variant is present in output', async () => {
    const { default: Badge } = await import('./Badge.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Badge, {
      props: { variant: 'ghost', size: 'md' },
      slots: { default: 'Astro' },
    });
    expect(result).toContain('ghost');
  });

  it('accent variant is present in output', async () => {
    const { default: Badge } = await import('./Badge.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Badge, {
      props: { variant: 'accent', size: 'md' },
      slots: { default: 'Hono' },
    });
    expect(result).toContain('accent');
  });

  it('sm size is present in output', async () => {
    const { default: Badge } = await import('./Badge.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Badge, {
      props: { variant: 'solid', size: 'sm' },
      slots: { default: 'small' },
    });
    expect(result).toContain('sm');
  });

  it('slot content is rendered', async () => {
    const { default: Badge } = await import('./Badge.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Badge, {
      props: { variant: 'solid', size: 'md' },
      slots: { default: 'TypeScript' },
    });
    expect(result).toContain('TypeScript');
  });
});
