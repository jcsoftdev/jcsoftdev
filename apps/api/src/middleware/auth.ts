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

const SESSION_KEY = 'auth_session' as const;
const USER_KEY = 'auth_user' as const;

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
