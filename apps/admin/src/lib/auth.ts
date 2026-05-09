/**
 * better-auth client wrapper for the admin SPA.
 *
 * Uses createAuthClient from better-auth/client with the magicLinkClient
 * plugin (required to get signIn.magicLink on the client).
 *
 * Functions:
 *   requestMagicLink({ email, callbackURL }) — sends the magic-link email
 *   getSession() — returns the current session or null
 *   signOut() — clears the session cookie
 *
 * Design §6 — auth client replaces the Phase 2 stub.
 * better-auth version: 1.6.9 (same as API).
 */
import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

const apiUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
    : 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: apiUrl,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [magicLinkClient()],
});

export interface MagicLinkInput {
  email: string;
  callbackURL: string;
}

// Session type — matches better-auth's session shape at runtime
export interface SessionUser {
  id: string;
  email: string;
  name?: string;
}

export interface Session {
  user: SessionUser;
  session: { id: string; [key: string]: unknown };
}

/**
 * Sends a magic-link email to the given address.
 */
export async function requestMagicLink(input: MagicLinkInput) {
  return authClient.signIn.magicLink({
    email: input.email,
    callbackURL: input.callbackURL,
  });
}

/**
 * Returns the current authenticated session or null.
 */
export async function getSession(): Promise<Session | null> {
  const result = await authClient.getSession();
  if (result.error || !result.data) {
    return null;
  }
  return result.data as Session;
}

/**
 * Signs out the current user.
 */
export async function signOut() {
  return authClient.signOut();
}
