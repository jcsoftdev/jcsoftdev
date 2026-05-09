/**
 * Rate limiter — Phase 4
 *
 * Fixed-window rate limiter backed by Valkey.
 *
 * Algorithm:
 *   1. GET key → parse integer count (null → 0)
 *   2. If count >= maxRequests → blocked
 *   3. Else → SET key (count+1) EX windowSeconds (first write sets TTL)
 *
 * This is a fixed-window counter. The window resets when the key expires.
 * It's simple, predictable, and sufficient for the magic-link use case where
 * the window is 1 hour and burst precision is not critical.
 *
 * Design note: we do NOT use INCR + EXPIRE in two calls because Valkey is
 * single-threaded and each call is atomic. However, there is a TOCTOU window
 * between GET and SET. For the magic-link use case (human-scale rates, 5/hr),
 * this is acceptable. A Lua script would close the gap if needed.
 */

import type { ValkeyClient } from './valkey.js';

export interface RateLimitOptions {
  /** The Valkey key for this rate-limit bucket (include email/IP in the key) */
  key: string;
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Seconds until the window resets (only meaningful when allowed=false) */
  retryAfter?: number;
}

/**
 * Check and increment a rate-limit counter in Valkey.
 *
 * @param valkey  ValkeyClient instance
 * @param options Rate-limit options
 * @returns       RateLimitResult — caller checks `allowed` and acts accordingly
 */
export async function checkRateLimit(
  valkey: ValkeyClient,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, maxRequests, windowSeconds } = options;

  // Read current count
  const raw = await valkey.get(key);
  const current = raw !== null ? parseInt(raw, 10) : 0;

  if (current >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: windowSeconds,
    };
  }

  // Increment — SET with TTL on first write so the key auto-expires
  const next = current + 1;
  if (current === 0) {
    // First request in the window — set with TTL to start the window
    await valkey.set(key, String(next), windowSeconds);
  } else {
    // Subsequent requests — overwrite but DO NOT reset TTL
    // (so the window stays anchored to the first request)
    await valkey.set(key, String(next));
  }

  return {
    allowed: true,
    remaining: maxRequests - next,
  };
}
