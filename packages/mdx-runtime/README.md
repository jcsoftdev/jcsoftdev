# @jcsoftdev/mdx-runtime

Server-side MDX compilation with Valkey caching for the jcsoftdev blog.

Used exclusively by `apps/api` — **never import this in browser bundles** (it depends on `react-dom/server` and `@mdx-js/mdx` which are server-only).

---

## Usage

### Compile MDX to HTML (no cache)

```ts
import { compileMdx } from '@jcsoftdev/mdx-runtime';

const result = await compileMdx('# Hello\n\nWorld');

if (result.ok) {
  console.log(result.html); // '<h1>Hello</h1><p>World</p>'
} else {
  console.error(result.error); // MDX compile error
}
```

The return type is a discriminated union:

```ts
type CompileResult =
  | { ok: true; html: string }
  | { ok: false; error: Error };
```

`compileMdx` **never throws** — errors are returned as `{ ok: false, error }`.

### Cache key format

```ts
import { mdxCacheKey } from '@jcsoftdev/mdx-runtime';

// Format: mdx:{slug}:{updatedAt.toISOString()}
const key = mdxCacheKey('my-post-slug', new Date('2026-01-15T10:00:00Z'));
// → 'mdx:my-post-slug:2026-01-15T10:00:00.000Z'
```

The `updatedAt` timestamp is included in the key so edits to a post automatically invalidate the cache entry (new key = cache miss = recompile).

### Compile with Valkey cache

```ts
import { cachedCompile } from '@jcsoftdev/mdx-runtime';

const result = await cachedCompile({
  slug: 'my-post',
  updated_at: post.updatedAt,
  source: post.content,
  valkey: valkeyClient, // must implement ValkeyClient interface
  ttlSeconds: 86400,   // optional, defaults to 86400 (24h)
});

if (result.ok) {
  console.log(result.html);
}
```

Cache flow:
1. Compute key: `mdx:{slug}:{updatedAt.toISO()}`
2. `valkey.get(key)` — cache hit → return immediately
3. Cache miss → `compileMdx(source)` → `valkey.set(key, html, 'EX', ttlSeconds)` → return

---

## Component Allow-List

The allow-list is currently **empty** — only plain HTML elements are permitted in MDX content. No custom React components are exposed to MDX authors.

This is a deliberate security decision (ADR, design §8): the admin is a single-user system, but defense-in-depth still applies. Expanding the allow-list requires modifying `src/compile.ts` and documenting the risk.

Attempting to use a custom component in MDX:
```mdx
<MyComponent />   <!-- ← will throw at compile time: component not in allow-list -->
```

Standard HTML elements work as expected:
```mdx
# Heading

A paragraph with **bold** and _italic_.

- List item
- Another item

<div class="callout">Custom class on a native element is fine.</div>
```

---

## ValkeyClient Interface

```ts
export interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: 'EX', ttl: number): Promise<'OK' | null>;
}
```

Pass any Valkey/Redis client that implements this interface. In `apps/api`, a thin adapter (`toMdxValkey()`) bridges the `iovalkey` client to this interface.

---

## Exports

```ts
export { compileMdx } from './compile.js';
export type { CompileResult } from './compile.js';

export { mdxCacheKey, cachedCompile } from './cache.js';
export type { ValkeyClient, CachedCompileOptions } from './cache.js';
```
