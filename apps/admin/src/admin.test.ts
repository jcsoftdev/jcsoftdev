import { describe, expect, it } from 'vitest';

describe('auth client', () => {
  it('getSession resolves (returns session or null)', async () => {
    // We mock better-auth/client so no real network calls happen in tests.
    // Just verify the function exists and is callable.
    const { getSession } = await import('./lib/auth.js');
    expect(typeof getSession).toBe('function');
    // getSession is now async — it calls better-auth client
    const result = await getSession();
    // In test env (no real server), better-auth returns error → null
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('requestMagicLink is exported as a function', async () => {
    const { requestMagicLink } = await import('./lib/auth.js');
    expect(typeof requestMagicLink).toBe('function');
  });
});

describe('route modules', () => {
  it('routeTree.gen exports routeTree', async () => {
    // Verify the module graph resolves without error.
    // Full router instantiation is validated during vite build + dev.
    const mod = await import('./routeTree.gen.js');
    expect(mod.routeTree).toBeDefined();
  });
});
