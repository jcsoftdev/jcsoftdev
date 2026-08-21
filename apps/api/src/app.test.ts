import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const app = createApp({ corsOrigins: ['http://localhost:4321'] });

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/v1/hello', () => {
  it('returns 200 with message and time', async () => {
    const res = await app.request('/api/v1/hello');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string; time: string };
    expect(body.message).toBe('hello from jcsoftdev api');
    expect(typeof body.time).toBe('string');
    expect(new Date(body.time).toISOString()).toBe(body.time);
  });
});

describe('Auth handler mount (/auth/*)', () => {
  it('delegates /auth/* requests to the auth handler', async () => {
    const fakeResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fakeAuth = {
      handler: vi.fn().mockResolvedValue(fakeResponse),
    };

    const appWithAuth = createApp({
      corsOrigins: ['http://localhost:4321'],
      authHandler: fakeAuth.handler,
    });

    const res = await appWithAuth.request('/auth/get-session');
    expect(fakeAuth.handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it('does not break existing routes when auth handler is provided', async () => {
    const fakeAuth = {
      handler: vi.fn().mockResolvedValue(new Response('', { status: 200 })),
    };
    const appWithAuth = createApp({
      corsOrigins: ['http://localhost:4321'],
      authHandler: fakeAuth.handler,
    });

    const res = await appWithAuth.request('/health');
    expect(res.status).toBe(200);
  });

  it('works without an authHandler (backward compatible)', async () => {
    const appNoAuth = createApp({ corsOrigins: ['http://localhost:4321'] });
    const res = await appNoAuth.request('/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /ready', () => {
  it('returns 503 when db/valkey are not configured', async () => {
    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; db: boolean; valkey: boolean };
    expect(body.status).toBe('unavailable');
    expect(body.db).toBe(false);
    expect(body.valkey).toBe(false);
  });

  it('returns 200 when both db and valkey respond', async () => {
    const okApp = createApp({
      corsOrigins: ['http://localhost:4321'],
      // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for readiness ping
      db: { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as any,
      // biome-ignore lint/suspicious/noExplicitAny: minimal fakes for readiness ping
      valkey: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() } as any,
      // biome-ignore lint/suspicious/noExplicitAny: presigner unused by /ready
      presigner: {} as any,
    });

    const res = await okApp.request('/ready');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ready');
  });
});

describe('global body limit', () => {
  it('rejects an oversized JSON body with 413', async () => {
    // > 1 MB payload
    const huge = 'x'.repeat(1_048_577);
    const res = await app.request('/api/v1/hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob: huge }),
    });
    expect(res.status).toBe(413);
  });
});

describe('global error handler (onError)', () => {
  it('returns a generic 500 JSON body when a handler throws', async () => {
    const throwingApp = createApp({
      corsOrigins: ['http://localhost:4321'],
      // biome-ignore lint/suspicious/noExplicitAny: db.select throws to exercise onError
      db: {
        select: () => {
          throw new Error('boom');
        },
      } as any,
      // biome-ignore lint/suspicious/noExplicitAny: minimal fakes
      valkey: { get: vi.fn(), set: vi.fn(), del: vi.fn() } as any,
      // biome-ignore lint/suspicious/noExplicitAny: unused here
      presigner: {} as any,
      adminEmails: ['admin@jcsoftdev.com'],
      // Inject an authenticated admin session so requireAuth passes and the
      // handler runs (and throws on db.select)
      authMiddlewareHandler: async (c, next) => {
        // biome-ignore lint/suspicious/noExplicitAny: setting context vars in test
        (c as any).set('auth_session', { token: 't', userId: 'u1' });
        // biome-ignore lint/suspicious/noExplicitAny: setting context vars in test
        (c as any).set('auth_user', { id: 'u1', email: 'admin@jcsoftdev.com' });
        await next();
      },
    });

    const res = await throwingApp.request('/api/v1/posts/some-id');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Internal Server Error');
  });
});
