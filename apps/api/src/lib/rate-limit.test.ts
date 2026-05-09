import { describe, expect, it, vi } from 'vitest';
import { checkRateLimit, type RateLimitResult } from './rate-limit.js';

// ---------------------------------------------------------------------------
// Fake in-memory Valkey for rate-limit tests
// ---------------------------------------------------------------------------

type RLStoreEntry = { value: string; expiresAt: number } | { value: string };

function makeFakeValkey() {
  const store = new Map<string, RLStoreEntry>();
  return {
    get: vi.fn(async (key: string): Promise<string | null> => {
      const entry = store.get(key);
      if (!entry) return null;
      if ('expiresAt' in entry && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ttlSeconds?: number): Promise<string | null> => {
      if (ttlSeconds !== undefined) {
        store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      } else {
        store.set(key, { value });
      }
      return 'OK';
    }),
    del: vi.fn(async (key: string): Promise<number> => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    _store: store,
  };
}

describe('checkRateLimit', () => {
  it('allows the first request (count 1 of N)', async () => {
    const fakeValkey = makeFakeValkey();
    const result = await checkRateLimit(fakeValkey, {
      key: 'magic-link:email:admin@jcsoftdev.com',
      maxRequests: 5,
      windowSeconds: 3600,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows up to maxRequests (5th request is still allowed)', async () => {
    const fakeValkey = makeFakeValkey();
    const opts = {
      key: 'magic-link:email:admin@jcsoftdev.com',
      maxRequests: 5,
      windowSeconds: 3600,
    };
    let result: RateLimitResult = { allowed: false, remaining: 0 };
    for (let i = 0; i < 5; i++) {
      result = await checkRateLimit(fakeValkey, opts);
    }
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('blocks the 6th request within the window (returns allowed=false)', async () => {
    const fakeValkey = makeFakeValkey();
    const opts = {
      key: 'magic-link:email:admin@jcsoftdev.com',
      maxRequests: 5,
      windowSeconds: 3600,
    };
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(fakeValkey, opts);
    }
    const result = await checkRateLimit(fakeValkey, opts);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('returns retryAfter on blocked requests', async () => {
    const fakeValkey = makeFakeValkey();
    const opts = {
      key: 'rl:test',
      maxRequests: 1,
      windowSeconds: 60,
    };
    await checkRateLimit(fakeValkey, opts); // first — allowed
    const result = await checkRateLimit(fakeValkey, opts); // second — blocked
    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe('number');
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it('uses separate counters for different keys', async () => {
    const fakeValkey = makeFakeValkey();
    const opts1 = { key: 'rl:email:a@a.com', maxRequests: 1, windowSeconds: 3600 };
    const opts2 = { key: 'rl:email:b@b.com', maxRequests: 1, windowSeconds: 3600 };

    await checkRateLimit(fakeValkey, opts1); // a: 1 (allowed)
    const resultA = await checkRateLimit(fakeValkey, opts1); // a: 2 (blocked)
    const resultB = await checkRateLimit(fakeValkey, opts2); // b: 1 (allowed)

    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('sets the Valkey key with the correct window TTL', async () => {
    const fakeValkey = makeFakeValkey();
    await checkRateLimit(fakeValkey, {
      key: 'rl:ttl-test',
      maxRequests: 5,
      windowSeconds: 600,
    });
    // The key should exist with the correct TTL
    const rawValue = await fakeValkey.get('rl:ttl-test');
    expect(rawValue).toBe('1');
    // set should have been called with windowSeconds as TTL
    expect(fakeValkey.set).toHaveBeenCalledWith('rl:ttl-test', '1', 600);
  });

  it('increments counter across multiple calls in same window', async () => {
    const fakeValkey = makeFakeValkey();
    const opts = { key: 'rl:counter', maxRequests: 10, windowSeconds: 60 };
    for (let i = 1; i <= 3; i++) {
      const result = await checkRateLimit(fakeValkey, opts);
      expect(result.remaining).toBe(10 - i);
    }
  });
});
