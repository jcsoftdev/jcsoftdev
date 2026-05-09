/**
 * LoginForm component — magic-link request form.
 *
 * Design §6 — Login route (magic-link request form + check-email screen).
 * Uses TanStack Form for validation and state management.
 * On submit: calls requestMagicLink; on success: shows check-email screen.
 */
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { requestMagicLink } from '../lib/auth.js';

type FormState = 'idle' | 'loading' | 'sent';

export function LoginForm() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: '',
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      setFormState('loading');
      try {
        const result = await requestMagicLink({
          email: value.email,
          callbackURL: '/dashboard',
        });
        if (result.error) {
          setServerError(result.error.message ?? 'Failed to send magic link');
          setFormState('idle');
        } else {
          setFormState('sent');
        }
      } catch {
        setServerError('An unexpected error occurred');
        setFormState('idle');
      }
    },
  });

  if (formState === 'sent') {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="text-gray-600">
          We sent a magic link to your email address. Click the link to sign in.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) => {
            if (!value || value.trim() === '') {
              return 'Email is required';
            }
            // Basic email validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              return 'Please enter a valid email address';
            }
            return undefined;
          },
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-1">
            <label htmlFor={field.name} className="text-sm font-medium">
              Email
            </label>
            <input
              id={field.name}
              type="email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              className="rounded border px-3 py-2"
              placeholder="you@example.com"
              aria-label="Email"
            />
            {field.state.meta.errors.length > 0 && (
              <span className="text-sm text-red-600">{field.state.meta.errors.join(', ')}</span>
            )}
          </div>
        )}
      </form.Field>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={formState === 'loading'}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {formState === 'loading' ? 'Sending...' : 'Send magic link'}
      </button>
    </form>
  );
}
