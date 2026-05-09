/**
 * TDD RED — POST /api/v1/preview route tests
 *
 * Phase 6 carryover: server-side MDX preview rendering for the admin PostEditor.
 * Auth-required; compiles arbitrary MDX source and returns compiled HTML.
 * No caching — each call compiles fresh (admin-only UX endpoint).
 */

import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createPreviewRouter } from './preview.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/mdx.js', () => ({
  compileMdx: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp() {
  const app = new Hono();
  const router = createPreviewRouter();
  app.route('/api/v1/preview', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/preview', () => {
  it('returns 200 with compiled html for valid MDX source', async () => {
    const { compileMdx } = await import('../lib/mdx.js');
    vi.mocked(compileMdx).mockResolvedValueOnce('<h1>Hello</h1>');

    const app = buildApp();
    const res = await app.request('/api/v1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '# Hello' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('html');
    expect(body.html).toBe('<h1>Hello</h1>');
  });

  it('returns 422 when source is missing', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
  });

  it('returns 422 when source is empty string', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '' }),
    });

    expect(res.status).toBe(422);
  });

  it('returns 200 with fallback html on MDX compile failure', async () => {
    const { compileMdx } = await import('../lib/mdx.js');
    vi.mocked(compileMdx).mockRejectedValueOnce(new Error('MDX syntax error'));

    const app = buildApp();
    const res = await app.request('/api/v1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '<div unclosed' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('html');
    expect(typeof body.html).toBe('string');
    expect(body.html.length).toBeGreaterThan(0);
  });

  it('returns 400 on invalid JSON body', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    expect(res.status).toBe(400);
  });
});
