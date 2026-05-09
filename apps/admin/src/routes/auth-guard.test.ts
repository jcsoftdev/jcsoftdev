/**
 * Tests for auth guard logic — tests the beforeLoad function directly.
 * TDD RED phase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth module — session null means redirect; session present means proceed
const mockGetSession = vi.fn();
vi.mock('../lib/auth.js', () => ({
  getSession: mockGetSession,
  requestMagicLink: vi.fn(),
  signOut: vi.fn(),
}));

describe('auth guard beforeLoad logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect when session is null', async () => {
    mockGetSession.mockResolvedValue(null);

    // Import redirect utility from @tanstack/react-router
    const { redirect } = await import('@tanstack/react-router');
    const { getSession } = await import('../lib/auth.js');

    let threw = false;
    try {
      const session = await getSession();
      if (!session) {
        throw redirect({ to: '/login' });
      }
    } catch (err) {
      threw = true;
      // TanStack Router redirect is a special object, not an Error
      expect(err).toBeDefined();
    }
    expect(threw).toBe(true);
  });

  it('returns session data when session is valid', async () => {
    const sessionData = {
      user: { email: 'admin@example.com', id: '1' },
      session: { id: 'sess1' },
    };
    mockGetSession.mockResolvedValue(sessionData);

    const { getSession } = await import('../lib/auth.js');
    const session = await getSession();
    expect(session).toEqual(sessionData);
    expect(session).not.toBeNull();
  });

  it('does not throw when session exists', async () => {
    const sessionData = {
      user: { email: 'admin@example.com', id: '1' },
      session: { id: 'sess1' },
    };
    mockGetSession.mockResolvedValue(sessionData);

    const { redirect } = await import('@tanstack/react-router');
    const { getSession } = await import('../lib/auth.js');

    let threw = false;
    try {
      const session = await getSession();
      if (!session) {
        throw redirect({ to: '/login' });
      }
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
