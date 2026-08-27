/**
 * Auth layout route — guards all nested routes and owns the admin chrome.
 *
 * Design §6 — auth guard: beforeLoad calls auth.getSession() (async).
 * If no session → redirect to /login.
 *
 * The layout also renders the only navigation in the app. Before it existed,
 * /projects and /experiences were fully built but unreachable — nothing linked
 * to them — and signOut() was exported with zero callers, so a session could
 * only be ended by waiting for the cookie to expire.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { getSession, signOut } from '../lib/auth.js';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    return { session };
  },
  component: AuthLayout,
});

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/posts', label: 'Posts' },
  { to: '/projects', label: 'Projects' },
  { to: '/experiences', label: 'Experiences' },
] as const;

function AuthLayout() {
  return (
    <>
      <AdminNav />
      <Outlet />
    </>
  );
}

export function AdminNav() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Drop every cached response before leaving — otherwise the next account
      // to sign in on this browser briefly renders the previous one's data.
      qc.clear();
      navigate({ to: '/login' });
    }
  }

  return (
    <nav
      aria-label="Admin"
      className="flex items-center justify-between gap-4 border-b bg-white px-8 py-3"
    >
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              activeProps={{
                className: 'rounded px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-900',
                'aria-current': 'page',
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  );
}
