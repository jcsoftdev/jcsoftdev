/**
 * MDX runtime — thin re-export from @jcsoftdev/mdx-runtime (Phase 3).
 *
 * Phase 2 stubs replaced. All three functions are now fully implemented.
 * Phase 5 routes that call compileMdx / compileMdxWithCache will work.
 */
import type { ValkeyClient } from '@jcsoftdev/mdx-runtime';
import {
  compileMdx as _compileMdx,
  mdxCacheKey as _mdxCacheKey,
  cachedCompile,
} from '@jcsoftdev/mdx-runtime';

/**
 * Compile MDX source to an HTML string.
 * Returns an HTML string on success.
 * Throws on compile failure (wraps the discriminated union for route-handler ergonomics).
 */
export async function compileMdx(source: string): Promise<string> {
  const result = await _compileMdx(source);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.html;
}

/**
 * Build a Valkey cache key for a compiled MDX document.
 * Key format: `mdx:{slug}:{updatedAt.toISOString()}`
 */
export function mdxCacheKey(slug: string, updatedAt: Date): string {
  return _mdxCacheKey(slug, updatedAt);
}

/**
 * Compile MDX with Valkey caching.
 * Cache miss → compile + store. Cache hit → return directly.
 * Throws on compile failure so the route handler can catch and return a safe fallback.
 */
export async function compileMdxWithCache(
  slug: string,
  source: string,
  updatedAt: Date,
  valkey: ValkeyClient
): Promise<string> {
  const result = await cachedCompile({
    slug,
    updated_at: updatedAt,
    source,
    valkey,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.html;
}
