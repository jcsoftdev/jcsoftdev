/**
 * @jcsoftdev/mdx-runtime
 *
 * MDX compile pipeline with Valkey cache support.
 *
 * Exports:
 * - compileMdx    — compile MDX source to HTML (safe, allow-list guarded)
 * - cachedCompile — Valkey-backed wrapper around compileMdx
 * - mdxCacheKey   — cache key factory `mdx:{slug}:{updated_at_iso}`
 * - Types: CompileResult, CachedCompileResult, ValkeyClient, CachedCompileArgs
 */
export type { CachedCompileArgs, CachedCompileResult, ValkeyClient } from './cache.js';
export { cachedCompile, mdxCacheKey } from './cache.js';
export type { CompileResult } from './compile.js';
export { compileMdx } from './compile.js';
