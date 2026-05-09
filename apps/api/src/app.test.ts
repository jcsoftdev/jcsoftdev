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
