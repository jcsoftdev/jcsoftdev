/**
 * Portfolio Valkey cache — single-key wrapper for the public portfolio payload.
 *
 * Design ADR-13: one combined key `public:portfolio:v1`, TTL 300s, DELETE-on-write.
 *
 * Key: `public:portfolio:v1`
 * Value: JSON.stringify({ projects: PublicProject[], experiences: PublicExperience[] })
 *
 * Behaviour:
 *   - GET: try Valkey → on miss call fetcher → write result to cache → return
 *   - FAILURE: any Valkey error → fall through to fetcher; NEVER throw / 500
 *   - INVALIDATE: delete the key; cache miss on next read re-populates
 */

import type { ValkeyClient } from './valkey.js';

/** Single Valkey key for the entire public portfolio payload (ADR-13). */
export const PORTFOLIO_CACHE_KEY = 'public:portfolio:v1' as const;

/** TTL for cache entries — 300 seconds (5 minutes) per design §4. */
const CACHE_TTL_SECONDS = 300;

/**
 * Attempt to retrieve the portfolio payload from cache.
 * On cache miss or failure, call `fetcher` and write the result to cache.
 *
 * @param valkey  - Valkey client
 * @param fetcher - Async function that fetches the canonical payload from DB
 * @returns       The portfolio payload (from cache or DB)
 */
export async function getCachedPortfolio<T>(
  valkey: ValkeyClient,
  fetcher: () => Promise<T>
): Promise<T> {
  // 1. Try cache read
  try {
    const cached = await valkey.get(PORTFOLIO_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Valkey unavailable — fall through to DB
  }

  // 2. Cache miss (or failure) → fetch from DB
  const payload = await fetcher();

  // 3. Write to cache asynchronously; failure must NOT propagate to caller
  try {
    await valkey.set(PORTFOLIO_CACHE_KEY, JSON.stringify(payload), CACHE_TTL_SECONDS);
  } catch {
    // Cache write failure is non-fatal — data was still fetched from DB
  }

  return payload;
}

/**
 * Delete the portfolio cache key.
 *
 * Called after every successful admin mutation (POST/PATCH/DELETE on projects
 * or experiences) so that the next public read re-populates with fresh data.
 *
 * Per design §4: cache-del lives AFTER the DB transaction commits.
 * Any Valkey failure is silently swallowed — cache miss is safe.
 */
export async function invalidatePortfolioCache(valkey: ValkeyClient): Promise<void> {
  try {
    await valkey.del(PORTFOLIO_CACHE_KEY);
  } catch {
    // Silent fail — next cache get will miss and re-populate from DB
  }
}
