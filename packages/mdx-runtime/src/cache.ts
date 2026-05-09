/**
 * Valkey cache wrapper for compiled MDX.
 *
 * Design:
 * - Cache key: `mdx:{slug}:{updated_at ISO string}`
 * - TTL: 24h (86400s) by default, configurable
 * - Cache miss: compile → set → return
 * - Cache hit: return cached HTML directly (no compile call)
 * - Compile error: do NOT cache; return error object
 *
 * The ValkeyClient interface is dependency-injected so this module
 * never imports iovalkey directly — fully testable with an in-memory fake.
 */
import { type CompileResult, compileMdx } from './compile.js';

/**
 * Minimal interface for the Valkey client.
 * Matches the subset of iovalkey we need — injected by the caller.
 */
export interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: 'EX', ttl: number): Promise<'OK' | null>;
}

/**
 * Arguments for cachedCompile.
 */
export interface CachedCompileArgs {
  /** Post slug — used as part of the cache key */
  slug: string;
  /** Post updated_at timestamp — used as part of the cache key */
  updated_at: Date;
  /** Raw MDX source content */
  source: string;
  /** Injected Valkey client — must implement ValkeyClient */
  valkey: ValkeyClient;
  /** Cache TTL in seconds (default: 86400 = 24h) */
  ttl?: number;
}

/**
 * Result of cachedCompile — same discriminated union as compileMdx.
 */
export type CachedCompileResult = CompileResult;

/** Default TTL: 24 hours in seconds */
const DEFAULT_TTL_SECONDS = 86400;

/**
 * Compute the Valkey cache key for a compiled MDX document.
 *
 * Format: `mdx:{slug}:{updatedAt.toISOString()}`
 */
export function mdxCacheKey(slug: string, updatedAt: Date): string {
  return `mdx:${slug}:${updatedAt.toISOString()}`;
}

/**
 * Compile MDX with Valkey cache.
 *
 * - Cache hit  → return cached HTML; skip compile
 * - Cache miss → compile → if ok, set in Valkey with TTL → return
 * - Compile error → do NOT cache; return error object
 */
export async function cachedCompile(args: CachedCompileArgs): Promise<CachedCompileResult> {
  const { slug, updated_at, source, valkey, ttl = DEFAULT_TTL_SECONDS } = args;

  const key = mdxCacheKey(slug, updated_at);

  // Cache hit?
  const cached = await valkey.get(key);
  if (cached !== null) {
    return { ok: true, html: cached };
  }

  // Cache miss — compile
  const result = await compileMdx(source);

  // Only cache on success
  if (result.ok) {
    await valkey.set(key, result.html, 'EX', ttl);
  }

  return result;
}
