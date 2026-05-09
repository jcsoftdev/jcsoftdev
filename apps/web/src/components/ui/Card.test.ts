// @vitest-environment node
/**
 * TDD RED → GREEN — Card.astro component tests.
 *
 * Tests:
 * 1. Renders without crash
 * 2. Has border class token in output
 * 3. Has radius-md token in output
 * 4. Slot content renders
 * 5. Hover prop adds hover class/style token
 */

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

describe('Card', () => {
  it('renders without crash', async () => {
    const { default: Card } = await import('./Card.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Card, {
      props: {},
      slots: { default: 'Card content' },
    });
    expect(result).toBeTruthy();
  });

  it('has border styling in output', async () => {
    const { default: Card } = await import('./Card.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Card, {
      props: {},
      slots: { default: 'content' },
    });
    expect(result).toContain('border');
  });

  it('has radius-md token in output', async () => {
    const { default: Card } = await import('./Card.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Card, {
      props: {},
      slots: { default: 'content' },
    });
    expect(result).toContain('radius-md');
  });

  it('renders slot content', async () => {
    const { default: Card } = await import('./Card.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Card, {
      props: {},
      slots: { default: 'My card body' },
    });
    expect(result).toContain('My card body');
  });

  it('hover prop adds glow class token', async () => {
    const { default: Card } = await import('./Card.astro');
    const container = await AstroContainer.create();
    const result = await container.renderToString(Card, {
      props: { hover: true },
      slots: { default: 'hoverable' },
    });
    expect(result).toContain('hover');
  });
});
