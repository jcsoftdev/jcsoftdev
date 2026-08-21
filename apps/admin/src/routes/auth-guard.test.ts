/**
 * Tests for the auth guard — imports the real beforeLoad from _auth.tsx
 * instead of reimplementing its logic inline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
vi.mock('../lib/auth.js', () => ({
  getSession: mockGetSession,
  requestMagicLink: vi.fn(),
  signOut: vi.fn(),
}));

describe('_auth beforeLoad guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect to /login when session is null', async () => {
    mockGetSession.mockResolvedValue(null);
    const { Route } = await import('./_auth.js');

    await expect(Route.options.beforeLoad!({} as never)).rejects.toMatchObject({
      options: { to: '/login' },
    });
  });

  it('returns session data when session is valid', async () => {
    const sessionData = {
      user: { email: 'admin@example.com', id: '1' },
      session: { id: 'sess1' },
    };
    mockGetSession.mockResolvedValue(sessionData);
    const { Route } = await import('./_auth.js');

    const result = await Route.options.beforeLoad!({} as never);
    expect(result).toEqual({ session: sessionData });
  });

  it('does not throw when session exists', async () => {
    mockGetSession.mockResolvedValue({
      user: { email: 'admin@example.com', id: '1' },
      session: { id: 'sess1' },
    });
    const { Route } = await import('./_auth.js');

    await expect(Route.options.beforeLoad!({} as never)).resolves.toBeDefined();
  });
});
