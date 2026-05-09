/**
 * Auth layout route — guards all nested routes.
 *
 * Design §6 — auth guard: beforeLoad calls auth.getSession() (async).
 * If no session → redirect to /login.
 */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '../lib/auth.js';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { session };
  },
  component: () => <Outlet />,
});
