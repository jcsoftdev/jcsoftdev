/**
 * Login route — magic-link request form.
 *
 * Design §6 — /login route: shows LoginForm component.
 * Not auth-guarded (public route).
 */
import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '../components/LoginForm.js';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Sign in to jcsoftdev Admin</h1>
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  );
}
