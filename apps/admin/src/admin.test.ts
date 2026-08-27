import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// better-auth client mock
//
// This file previously carried the comment "We mock better-auth/client so no
// real network calls happen in tests" while mocking nothing at all. getSession()
// therefore issued a live fetch to the dev fallback URL (http://localhost:8787,
// where nothing listens) and failed with ECONNREFUSED on every machine and in
// CI. Its only assertion — `result === null || typeof result === 'object'` —
// was a tautology that could not fail on any value it was given.
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockMagicLink = vi.fn();

vi.mock('better-auth/client', () => ({
  createAuthClient: () => ({
    getSession: mockGetSession,
    signOut: mockSignOut,
    signIn: { magicLink: mockMagicLink },
  }),
}));

vi.mock('better-auth/client/plugins', () => ({
  magicLinkClient: () => ({}),
}));

describe('auth client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSession returns the session payload when the client resolves data', async () => {
    const session = {
      user: { id: 'u-1', email: 'admin@example.com' },
      session: { id: 's-1' },
    };
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const { getSession } = await import('./lib/auth.js');
    await expect(getSession()).resolves.toEqual(session);
  });

  it('getSession returns null when the client reports an error', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: { message: 'unauthorized' } });

    const { getSession } = await import('./lib/auth.js');
    await expect(getSession()).resolves.toBeNull();
  });

  it('getSession returns null when the client resolves no data', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    const { getSession } = await import('./lib/auth.js');
    await expect(getSession()).resolves.toBeNull();
  });

  it('requestMagicLink forwards email and callbackURL to the client', async () => {
    mockMagicLink.mockResolvedValue({ data: { status: true }, error: null });

    const { requestMagicLink } = await import('./lib/auth.js');
    await requestMagicLink({ email: 'admin@example.com', callbackURL: '/login/callback' });

    expect(mockMagicLink).toHaveBeenCalledWith({
      email: 'admin@example.com',
      callbackURL: '/login/callback',
    });
  });

  it('signOut delegates to the client', async () => {
    mockSignOut.mockResolvedValue({ data: null, error: null });

    const { signOut } = await import('./lib/auth.js');
    await signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
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
