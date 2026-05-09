/**
 * TDD RED — portfolio-cache tests
 *
 * Scenarios:
 *   - get: cache hit → returns parsed payload; no fetcher called
 *   - get: cache miss → calls fetcher → writes to cache → returns data
 *   - get: cache failure (Valkey throws) → falls through to fetcher (no 500)
 *   - invalidate: calls valkey.del with correct key
 *   - invalidate: Valkey throws → does NOT throw (silent fail)
 */

import { describe, expect, it, vi } from 'vitest';
import {
  getCachedPortfolio,
  invalidatePortfolioCache,
  PORTFOLIO_CACHE_KEY,
} from './portfolio-cache.js';
import type { ValkeyClient } from './valkey.js';

// ---------------------------------------------------------------------------
// Mock Valkey
// ---------------------------------------------------------------------------

function createMockValkey(overrides: Partial<ValkeyClient> = {}): ValkeyClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sample payload
// ---------------------------------------------------------------------------

const SAMPLE_PAYLOAD = {
  projects: [{ id: 'proj-1', slug: 'my-project', name: 'My Project' }],
  experiences: [{ id: 'exp-1', company: 'ACME Corp', role: 'Engineer' }],
};

// ---------------------------------------------------------------------------
// Tests — getCachedPortfolio
// ---------------------------------------------------------------------------

describe('getCachedPortfolio — cache hit', () => {
  it('returns parsed payload from cache without calling fetcher', async () => {
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(JSON.stringify(SAMPLE_PAYLOAD)),
    });
    const fetcher = vi.fn();

    const result = await getCachedPortfolio(valkey, fetcher);

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual(SAMPLE_PAYLOAD);
  });
});

describe('getCachedPortfolio — cache miss', () => {
  it('calls fetcher, writes result to cache, returns data', async () => {
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(null),
    });
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_PAYLOAD);

    const result = await getCachedPortfolio(valkey, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(SAMPLE_PAYLOAD);

    // Cache should be written with key and TTL 300
    expect(valkey.set).toHaveBeenCalledWith(
      PORTFOLIO_CACHE_KEY,
      JSON.stringify(SAMPLE_PAYLOAD),
      300
    );
  });
});

describe('getCachedPortfolio — Valkey failure fall-through', () => {
  it('falls through to fetcher when Valkey.get throws', async () => {
    const valkey = createMockValkey({
      get: vi.fn().mockRejectedValue(new Error('Valkey connection refused')),
    });
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_PAYLOAD);

    // Should NOT throw — falls through to fetcher
    const result = await getCachedPortfolio(valkey, fetcher);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(SAMPLE_PAYLOAD);
  });

  it('returns fetcher data even when Valkey.set throws', async () => {
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('Valkey write failed')),
    });
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_PAYLOAD);

    const result = await getCachedPortfolio(valkey, fetcher);

    expect(result).toEqual(SAMPLE_PAYLOAD);
  });
});

// ---------------------------------------------------------------------------
// Tests — invalidatePortfolioCache
// ---------------------------------------------------------------------------

describe('invalidatePortfolioCache', () => {
  it('calls valkey.del with the correct cache key', async () => {
    const valkey = createMockValkey();

    await invalidatePortfolioCache(valkey);

    expect(valkey.del).toHaveBeenCalledWith(PORTFOLIO_CACHE_KEY);
  });

  it('does not throw when valkey.del throws', async () => {
    const valkey = createMockValkey({
      del: vi.fn().mockRejectedValue(new Error('Valkey del failed')),
    });

    await expect(invalidatePortfolioCache(valkey)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PORTFOLIO_CACHE_KEY constant
// ---------------------------------------------------------------------------

describe('PORTFOLIO_CACHE_KEY', () => {
  it('equals the design-mandated key value', () => {
    expect(PORTFOLIO_CACHE_KEY).toBe('public:portfolio:v1');
  });
});
