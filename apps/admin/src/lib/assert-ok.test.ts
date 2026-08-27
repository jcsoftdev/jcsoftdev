/**
 * assertOkJson — regression tests.
 *
 * The defect this guards: every admin queryFn used to call `res.json()`
 * directly. `fetch` resolves on 401/404/500, so the error body parsed cleanly
 * as the success type and TanStack Query never entered its error state — a
 * signed-out admin saw "No projects found" instead of an auth error.
 */
import { describe, expect, it } from 'vitest';
import { assertOkJson } from './assert-ok.js';

describe('assertOkJson', () => {
  it('returns the parsed body on a 2xx response', async () => {
    const res = { ok: true, status: 200, json: async () => ({ items: [1, 2], total: 2 }) };
    await expect(assertOkJson<{ total: number }>(res, 'projects')).resolves.toEqual({
      items: [1, 2],
      total: 2,
    });
  });

  it('throws on a non-2xx response instead of parsing the error body as success', async () => {
    const res = { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    await expect(assertOkJson(res, 'projects')).rejects.toThrow('Unauthorized');
  });

  it('falls back to status when the error body carries no message', async () => {
    const res = { ok: false, status: 500, json: async () => ({}) };
    await expect(assertOkJson(res, 'projects')).rejects.toThrow(
      'Failed to load projects: HTTP 500'
    );
  });

  it('still throws when the error body is not JSON at all', async () => {
    const res = {
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    };
    await expect(assertOkJson(res, 'posts')).rejects.toThrow('Failed to load posts: HTTP 502');
  });
});
