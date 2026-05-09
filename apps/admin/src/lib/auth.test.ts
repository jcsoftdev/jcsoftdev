/**
 * Tests for the better-auth client wrapper.
 * TDD phase — GREEN.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We mock the better-auth createAuthClient to control its behavior in tests.
vi.mock('better-auth/client', () => ({
  createAuthClient: vi.fn(() => ({
    signIn: {
      magicLink: vi.fn(),
    },
    getSession: vi.fn(),
    signOut: vi.fn(),
  })),
}));

describe('auth client — requestMagicLink', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a requestMagicLink function', async () => {
    const { requestMagicLink } = await import('./auth.js');
    expect(typeof requestMagicLink).toBe('function');
  });

  it('exports a getSession function', async () => {
    const { getSession } = await import('./auth.js');
    expect(typeof getSession).toBe('function');
  });

  it('exports a signOut function', async () => {
    const { signOut } = await import('./auth.js');
    expect(typeof signOut).toBe('function');
  });

  it('requestMagicLink calls authClient signIn.magicLink with email and callbackURL', async () => {
    const { createAuthClient } = await import('better-auth/client');
    const mockMagicLink = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockClient = {
      signIn: { magicLink: mockMagicLink },
      getSession: vi.fn(),
      signOut: vi.fn(),
    };
    // Use unknown cast to avoid strict type checking on the partial mock
    vi.mocked(createAuthClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAuthClient>
    );

    vi.resetModules();
    const { requestMagicLink } = await import('./auth.js');
    await requestMagicLink({ email: 'admin@example.com', callbackURL: '/dashboard' });

    expect(mockMagicLink).toHaveBeenCalledWith({
      email: 'admin@example.com',
      callbackURL: '/dashboard',
    });
  });

  it('getSession returns session data or null', async () => {
    const { createAuthClient } = await import('better-auth/client');
    const sessionData = { user: { email: 'admin@example.com', id: '1' }, session: { id: 'sess1' } };
    const mockGetSession = vi.fn().mockResolvedValue({ data: sessionData, error: null });
    const mockClient = {
      signIn: { magicLink: vi.fn() },
      getSession: mockGetSession,
      signOut: vi.fn(),
    };
    vi.mocked(createAuthClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAuthClient>
    );

    vi.resetModules();
    const { getSession } = await import('./auth.js');
    const result = await getSession();
    expect(result).toEqual(sessionData);
  });

  it('getSession returns null when better-auth returns error', async () => {
    const { createAuthClient } = await import('better-auth/client');
    const mockGetSession = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
    const mockClient = {
      signIn: { magicLink: vi.fn() },
      getSession: mockGetSession,
      signOut: vi.fn(),
    };
    vi.mocked(createAuthClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createAuthClient>
    );

    vi.resetModules();
    const { getSession } = await import('./auth.js');
    const result = await getSession();
    expect(result).toBeNull();
  });
});
