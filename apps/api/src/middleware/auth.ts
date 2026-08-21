/**
 * Auth middleware — Phase 4
 *
 * Provides two Hono middleware factories:
 *
 * 1. `authMiddleware(auth)` — attaches session + user to context variables
 *    on every request. Does NOT block unauthenticated requests — that is
 *    the responsibility of `requireAuth()`.
 *
 * 2. `requireAuth()` — must be used AFTER `authMiddleware`. Returns 401 if
 *    no session is attached to the context.
 *
 * Usage:
 *   app
 *     .use('*', authMiddleware(authInstance))
 *     .get('/protected', requireAuth(), handler)
 */

import type { Context, MiddlewareHandler, Next } from 'hono';

// ---------------------------------------------------------------------------
// Context variable types
// ---------------------------------------------------------------------------

/**
 * Minimal session shape we attach to context.
 * Phase 5 can widen this type when full session access is needed.
 */
export interface SessionData {
  token: string;
  userId: string;
  [key: string]: unknown;
}

export interface UserData {
  id: string;
  email: string;
  [key: string]: unknown;
}

/**
 * Auth instance shape — only the subset authMiddleware needs.
 * Accepts the real better-auth instance or a test double.
 */
export interface AuthInstanceForMiddleware {
  api: {
    getSession(opts: {
      headers: Headers;
    }): Promise<{ session: SessionData; user: UserData } | null>;
  };
}

// ---------------------------------------------------------------------------
// Internal context key — centralises the magic string used by both middleware
// ---------------------------------------------------------------------------

export const SESSION_KEY = 'auth_session' as const;
export const USER_KEY = 'auth_user' as const;
export const ADMIN_EMAILS_KEY = 'admin_emails' as const;

type AuthContextKey = typeof SESSION_KEY | typeof USER_KEY;

/**
 * Internal helper — typed wrapper around c.get / c.set so we avoid
 * `as any` casts in the middleware bodies.
 */
function setAuthVar(c: Context, key: AuthContextKey, value: SessionData | UserData | null): void {
  // Hono's context uses a plain Record internally; the `as Parameters` cast
  // is the standard Hono approach for typed variable access outside generics.
  (c as unknown as { set(k: string, v: unknown): void }).set(key, value);
}

function getAuthVar(c: Context, key: AuthContextKey): unknown {
  return (c as unknown as { get(k: string): unknown }).get(key);
}

/**
 * Store the admin allowlist on the context so `requireAdmin` can read it without
 * threading the list through every router factory. Set once in an app-level
 * middleware (see createApp).
 */
export function setAdminEmails(c: Context, emails: string[]): void {
  (c as unknown as { set(k: string, v: unknown): void }).set(
    ADMIN_EMAILS_KEY,
    emails.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)
  );
}

function getAdminEmails(c: Context): string[] {
  const value = (c as unknown as { get(k: string): unknown }).get(ADMIN_EMAILS_KEY);
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Typed accessor for the authenticated user's id.
 *
 * Replaces the `(c as any).get('auth_session')` casts sprinkled across route
 * handlers. Returns `undefined` when no session is attached — handlers behind
 * `requireAuth()` can safely assume it is present.
 */
export function getSessionUserId(c: Context): string | undefined {
  const session = getAuthVar(c, SESSION_KEY) as SessionData | null;
  return session?.userId;
}

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------

/**
 * Middleware that resolves the current session from the incoming cookie
 * and attaches `session` and `user` to the Hono context.
 *
 * - On valid session: sets context session + user.
 * - On no cookie / invalid token: sets both to null.
 * - NEVER blocks the request — use requireAuth() for that.
 */
export function authMiddleware(auth: AuthInstanceForMiddleware): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<void> => {
    try {
      const result = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (result) {
        setAuthVar(c, SESSION_KEY, result.session);
        setAuthVar(c, USER_KEY, result.user);
      } else {
        setAuthVar(c, SESSION_KEY, null);
        setAuthVar(c, USER_KEY, null);
      }
    } catch {
      // Any error from better-auth (network, crypto) — treat as unauthenticated
      setAuthVar(c, SESSION_KEY, null);
      setAuthVar(c, USER_KEY, null);
    }

    await next();
  };
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Guard middleware — returns 401 JSON if no session is attached to context.
 *
 * Must be mounted AFTER authMiddleware so the session variable is populated.
 *
 * Example:
 *   .post('/api/v1/posts', requireAuth(), createPostHandler)
 */
export function requireAuth(): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const session = getAuthVar(c, SESSION_KEY) as SessionData | null;

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
    return undefined;
  };
}

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/**
 * Authorization guard — returns 403 JSON unless the authenticated user's email
 * is in the admin allowlist (set on the context via `setAdminEmails`).
 *
 * Must be mounted AFTER `authMiddleware` (populates the user) and typically
 * AFTER `requireAuth()` (which returns 401 for anonymous requests). This is the
 * second half of the C1 fix: sign-up is disabled AND only allowlisted emails
 * may perform admin mutations, so a stray/leaked session for a non-admin user
 * cannot write.
 *
 * Fails closed: an empty allowlist rejects everyone.
 */
export function requireAdmin(): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const user = getAuthVar(c, USER_KEY) as UserData | null;

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const allowlist = getAdminEmails(c);
    const email = user.email?.toLowerCase();

    if (!email || !allowlist.includes(email)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
    return undefined;
  };
}
