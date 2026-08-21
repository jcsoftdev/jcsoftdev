import type { Context } from 'hono';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import {
  authMiddleware,
  getSessionUserId,
  requireAdmin,
  requireAuth,
  setAdminEmails,
} from './auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake auth instance whose api.getSession can be controlled */
function makeFakeAuth(sessionResult: unknown) {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionResult),
    },
    handler: vi.fn(),
  };
}

function buildApp(fakeAuth: ReturnType<typeof makeFakeAuth>) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper accesses internal context keys
  const honoAny = new Hono() as any;
  return honoAny.use('*', authMiddleware(fakeAuth as any)).get('/me', (c: Context) => {
    // biome-ignore lint/suspicious/noExplicitAny: reading typed context vars in test
    const ctx = c as any;
    const session = ctx.get('auth_session');
    const user = ctx.get('auth_user');
    return c.json({ session, user });
  });
}

function buildProtectedApp(fakeAuth: ReturnType<typeof makeFakeAuth>) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const honoAny = new Hono() as any;
  return honoAny
    .use('*', authMiddleware(fakeAuth as any))
    .get('/protected', requireAuth(), (c: Context) => {
      return c.json({ ok: true });
    });
}

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------

describe('authMiddleware', () => {
  it('passes through with session + user attached when cookie is valid', async () => {
    const fakeAuth = makeFakeAuth({
      session: { token: 'tok_abc', userId: 'user_1' },
      user: { id: 'user_1', email: 'admin@jcsoftdev.com' },
    });
    const app = buildApp(fakeAuth);

    const res = await app.request('/me', {
      headers: { Cookie: 'jcsoftdev.session_token=tok_abc' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: unknown; user: unknown };
    expect(body.session).not.toBeNull();
    expect(body.user).not.toBeNull();
  });

  it('sets session and user to null when no cookie is present', async () => {
    const fakeAuth = makeFakeAuth(null);
    const app = buildApp(fakeAuth);

    const res = await app.request('/me');

    // authMiddleware alone doesn't block — it just attaches null
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: unknown; user: unknown };
    expect(body.session).toBeNull();
    expect(body.user).toBeNull();
  });

  it('sets session and user to null when cookie is tampered / session not found', async () => {
    const fakeAuth = makeFakeAuth(null);
    const app = buildApp(fakeAuth);

    const res = await app.request('/me', {
      headers: { Cookie: 'jcsoftdev.session_token=tampered_garbage' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: unknown; user: unknown };
    expect(body.session).toBeNull();
    expect(body.user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  it('returns 401 when session is null (unauthenticated)', async () => {
    const fakeAuth = makeFakeAuth(null);
    const app = buildProtectedApp(fakeAuth);

    const res = await app.request('/protected');

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });

  it('allows request through when session is valid', async () => {
    const fakeAuth = makeFakeAuth({
      session: { token: 'tok_abc', userId: 'user_1' },
      user: { id: 'user_1', email: 'admin@jcsoftdev.com' },
    });
    const app = buildProtectedApp(fakeAuth);

    const res = await app.request('/protected', {
      headers: { Cookie: 'jcsoftdev.session_token=tok_abc' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 401 with a JSON error body', async () => {
    const fakeAuth = makeFakeAuth(null);
    const app = buildProtectedApp(fakeAuth);

    const res = await app.request('/protected');

    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

/** Build an app whose admin allowlist + authenticated user are injected. */
function buildAdminApp(allowlist: string[], user: { id: string; email: string } | null) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper accesses internal context keys
  const honoAny = new Hono() as any;
  return honoAny
    .use('*', async (c: Context, next: () => Promise<void>) => {
      setAdminEmails(c, allowlist);
      // biome-ignore lint/suspicious/noExplicitAny: reading typed context vars in test
      (c as any).set('auth_session', user ? { token: 't', userId: user.id } : null);
      // biome-ignore lint/suspicious/noExplicitAny: reading typed context vars in test
      (c as any).set('auth_user', user);
      await next();
    })
    .post('/admin', requireAuth(), requireAdmin(), (c: Context) => c.json({ ok: true }));
}

describe('requireAdmin', () => {
  it('returns 403 when the user email is not in the allowlist', async () => {
    const app = buildAdminApp(['admin@jcsoftdev.com'], {
      id: 'u1',
      email: 'intruder@evil.com',
    });

    const res = await app.request('/admin', { method: 'POST' });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Forbidden');
  });

  it('allows the request when the user email is in the allowlist (case-insensitive)', async () => {
    const app = buildAdminApp(['admin@jcsoftdev.com'], {
      id: 'u1',
      email: 'ADMIN@jcsoftdev.com',
    });

    const res = await app.request('/admin', { method: 'POST' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('fails closed: an empty allowlist rejects everyone with 403', async () => {
    const app = buildAdminApp([], { id: 'u1', email: 'admin@jcsoftdev.com' });

    const res = await app.request('/admin', { method: 'POST' });

    expect(res.status).toBe(403);
  });

  it('returns 401 before authorization when there is no session', async () => {
    const app = buildAdminApp(['admin@jcsoftdev.com'], null);

    const res = await app.request('/admin', { method: 'POST' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// getSessionUserId
// ---------------------------------------------------------------------------

describe('getSessionUserId', () => {
  it('returns the userId from the attached session', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper accesses internal context keys
    const honoAny = new Hono() as any;
    const app = honoAny
      .use('*', async (c: Context, next: () => Promise<void>) => {
        // biome-ignore lint/suspicious/noExplicitAny: setting typed context vars in test
        (c as any).set('auth_session', { token: 't', userId: 'user-42' });
        await next();
      })
      .get('/whoami', (c: Context) => c.json({ userId: getSessionUserId(c) ?? null }));

    const res = await app.request('/whoami');
    const body = (await res.json()) as { userId: string | null };
    expect(body.userId).toBe('user-42');
  });

  it('returns undefined when no session is attached', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper accesses internal context keys
    const honoAny = new Hono() as any;
    const app = honoAny.get('/whoami', (c: Context) =>
      c.json({ userId: getSessionUserId(c) ?? null })
    );

    const res = await app.request('/whoami');
    const body = (await res.json()) as { userId: string | null };
    expect(body.userId).toBeNull();
  });
});
