/**
 * TDD RED → GREEN — fetchApiJson unit tests.
 *
 * P3 remediation: portfolio-fetch.ts and blog-fetch.ts each repeated the
 * same "if (!res.ok) throw" + biome-ignore-cast dance for every Hono RPC
 * client call. fetchApiJson collapses the ok-check + json() parse into one
 * call site. It intentionally does NOT special-case any status (e.g. 404) —
 * that stays local to callers with different-than-"throw" semantics, like
 * blog-fetch.ts's fetchBlogPost.
 */

import { describe, expect, it } from 'vitest';
import { fetchApiJson } from './fetch-api-json.js';

describe('fetchApiJson — ok response', () => {
  it('parses and returns the JSON body', async () => {
    const res = {
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    };

    await expect(fetchApiJson(res, 'widgets')).resolves.toEqual({ hello: 'world' });
  });
});

describe('fetchApiJson — non-ok response', () => {
  it('throws an error naming the label and HTTP status', async () => {
    const res = {
      ok: false,
      status: 503,
      json: async () => ({}),
    };

    await expect(fetchApiJson(res, 'widgets')).rejects.toThrow('Failed to fetch widgets: HTTP 503');
  });
});
