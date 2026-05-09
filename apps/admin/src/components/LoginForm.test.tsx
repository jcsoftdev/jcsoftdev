/**
 * Tests for LoginForm component.
 * TDD RED: tests must fail before implementation.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth module
const mockRequestMagicLink = vi.fn();
vi.mock('../lib/auth.js', () => ({
  requestMagicLink: mockRequestMagicLink,
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', async () => {
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty and form is submitted', async () => {
    const user = userEvent.setup();
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    expect(mockRequestMagicLink).not.toHaveBeenCalled();
  });

  it('shows validation error when email is invalid', async () => {
    const user = userEvent.setup();
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(mockRequestMagicLink).not.toHaveBeenCalled();
  });

  it('calls requestMagicLink with email on valid submit', async () => {
    mockRequestMagicLink.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockRequestMagicLink).toHaveBeenCalledWith({
        email: 'admin@example.com',
        callbackURL: '/dashboard',
      });
    });
  });

  it('shows check-your-email screen after successful submit', async () => {
    mockRequestMagicLink.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('shows error message when requestMagicLink fails', async () => {
    mockRequestMagicLink.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });
    const user = userEvent.setup();
    const { LoginForm } = await import('./LoginForm.js');
    render(<LoginForm />);

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });
  });
});
