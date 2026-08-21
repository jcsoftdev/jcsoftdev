/**
 * Tests for the login callback route — magic-link verification terminal step.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
vi.mock('../lib/auth.js', () => ({
  getSession: mockGetSession,
  requestMagicLink: vi.fn(),
  signOut: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('login.callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to /dashboard when a session is found', async () => {
    mockGetSession.mockResolvedValue({
      user: { email: 'admin@example.com', id: '1' },
      session: { id: 'sess1' },
    });
    const { Route } = await import('./login.callback.js');
    const LoginCallbackPage = Route.options.component!;

    render(<LoginCallbackPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
    });
  });

  it('shows the error state when session is null', async () => {
    mockGetSession.mockResolvedValue(null);
    const { Route } = await import('./login.callback.js');
    const LoginCallbackPage = Route.options.component!;

    render(<LoginCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/magic link has expired or is invalid/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows "Authentication Failed" when getSession throws', async () => {
    mockGetSession.mockRejectedValue(new Error('network error'));
    const { Route } = await import('./login.callback.js');
    const LoginCallbackPage = Route.options.component!;

    render(<LoginCallbackPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /authentication failed/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/authentication failed\. please try again\./i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
