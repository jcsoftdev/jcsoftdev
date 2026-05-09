import { describe, expect, it, vi } from 'vitest';
import { cachedCompile, mdxCacheKey, type ValkeyClient } from './cache.js';

// In-memory fake Valkey client — no real Valkey needed
function createFakeValkey(): ValkeyClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, _ex: 'EX', _ttl: number) {
      store.set(key, value);
      return 'OK' as const;
    },
  };
}

describe('mdxCacheKey', () => {
  it('formats key as mdx:{slug}:{iso}', () => {
    const date = new Date('2026-05-01T00:00:00.000Z');
    expect(mdxCacheKey('hello-world', date)).toBe('mdx:hello-world:2026-05-01T00:00:00.000Z');
  });

  it('handles slugs with special characters', () => {
    const date = new Date('2026-01-15T12:30:00.000Z');
    expect(mdxCacheKey('my-post-123', date)).toBe('mdx:my-post-123:2026-01-15T12:30:00.000Z');
  });
});

describe('cachedCompile', () => {
  it('on cache miss: compiles, stores with correct key, and returns html', async () => {
    const valkey = createFakeValkey();
    const source = '# Hello Cache\n\nParagraph.';
    const slug = 'hello-cache';
    const updated_at = new Date('2026-05-01T00:00:00.000Z');
    const expectedKey = mdxCacheKey(slug, updated_at);

    const result = await cachedCompile({ slug, updated_at, source, valkey });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('Hello Cache');
    // Key must be stored in Valkey
    expect(valkey.store.has(expectedKey)).toBe(true);
    expect(valkey.store.get(expectedKey)).toBe(result.html);
  });

  it('on cache miss: TTL is passed to set (24h = 86400 seconds by default)', async () => {
    const valkey = createFakeValkey();
    const setSpy = vi.spyOn(valkey, 'set');

    await cachedCompile({
      slug: 'ttl-test',
      updated_at: new Date('2026-05-02T00:00:00.000Z'),
      source: '# TTL Test',
      valkey,
    });

    expect(setSpy).toHaveBeenCalledOnce();
    const firstCall = setSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const ttl = firstCall?.[3];
    expect(ttl).toBe(86400);
  });

  it('on cache hit: returns cached value and does NOT recompile', async () => {
    const valkey = createFakeValkey();
    const slug = 'cached-post';
    const updated_at = new Date('2026-05-03T00:00:00.000Z');
    const key = mdxCacheKey(slug, updated_at);
    const cachedHtml = '<h1>Cached Content</h1>';

    // Pre-populate cache
    valkey.store.set(key, cachedHtml);

    // Use bad source that would fail compilation to prove it's not run
    const result = await cachedCompile({
      slug,
      updated_at,
      source: '<BadMDXThatWouldFail unclosed',
      valkey,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toBe(cachedHtml);
  });

  it('on compile error: does NOT store in cache, returns error object', async () => {
    const valkey = createFakeValkey();
    const setSpy = vi.spyOn(valkey, 'set');

    const result = await cachedCompile({
      slug: 'broken-post',
      updated_at: new Date('2026-05-04T00:00:00.000Z'),
      source: '<UnsafeWidget prop="bad" />',
      valkey,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // Must not have cached the error
    expect(setSpy).not.toHaveBeenCalled();
    expect(valkey.store.size).toBe(0);
    expect(typeof result.error).toBe('string');
  });

  it('accepts custom TTL override', async () => {
    const valkey = createFakeValkey();
    const setSpy = vi.spyOn(valkey, 'set');

    await cachedCompile({
      slug: 'custom-ttl',
      updated_at: new Date('2026-05-05T00:00:00.000Z'),
      source: '# Custom TTL',
      valkey,
      ttl: 3600,
    });

    expect(setSpy).toHaveBeenCalledOnce();
    const firstCall = setSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const ttl = firstCall?.[3];
    expect(ttl).toBe(3600);
  });
});
