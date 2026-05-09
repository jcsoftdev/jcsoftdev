import { describe, expect, it } from 'vitest';

describe('@jcsoftdev/animations', () => {
  it('exports initLenis function', async () => {
    const { initLenis } = await import('./index.js');
    expect(typeof initLenis).toBe('function');
  });

  it('exports createHeroFadeTimeline function', async () => {
    const { createHeroFadeTimeline } = await import('./index.js');
    expect(typeof createHeroFadeTimeline).toBe('function');
  });

  it('initLenis returns null when called outside browser context (SSR)', async () => {
    const { initLenis } = await import('./index.js');
    // In Node/test environment, window is undefined — should return null (not throw)
    // Breaking change from previous behavior (ADR-12 + Lenis mobile guard).
    expect(initLenis()).toBeNull();
  });
});
