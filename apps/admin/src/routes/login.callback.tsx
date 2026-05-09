/**
 * Login callback route — handles magic-link verification.
 *
 * Design §6 — /login/callback: better-auth handles the token verification
 * server-side. This client-side route shows a loading state while the
 * better-auth redirect is processed.
 *
 * better-auth's magic-link flow:
 * 1. User clicks link → /login/callback?token=xxx
 * 2. better-auth client picks up the token via callbackURL
 * 3. On success → session cookie is set → redirect to callbackURL (/dashboard)
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getSession } from '../lib/auth.js';

export const Route = createFileRoute('/login/callback')({
  component: LoginCallbackPage,
});

function LoginCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Poll for session — better-auth processes the magic-link token and sets
    // the session cookie. Once the session is available, redirect to dashboard.
    async function checkSession() {
      try {
        const session = await getSession();
        if (session) {
          navigate({ to: '/dashboard' });
        } else {
          setError('Magic link has expired or is invalid. Please request a new one.');
        }
      } catch {
        setError('Authentication failed. Please try again.');
      }
    }
    checkSession();
  }, [navigate]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-red-600">Authentication Failed</h1>
        <p className="text-gray-600">{error}</p>
        <a href="/login" className="text-blue-600 underline">
          Back to login
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-gray-500">Verifying your magic link...</p>
    </main>
  );
}
