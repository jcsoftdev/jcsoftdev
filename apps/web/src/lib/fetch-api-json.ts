/**
 * fetchApiJson — shared "assert ok, then parse JSON" for Hono RPC client
 * responses. portfolio-fetch.ts and blog-fetch.ts each repeated an identical
 * `if (!res.ok) throw new Error(...)` + biome-ignore-cast dance for every
 * public API call; this collapses that to one call site.
 *
 * Deliberately does NOT special-case any status (e.g. 404). Callers with
 * different-than-"throw" semantics — like blog-fetch.ts's fetchBlogPost,
 * which returns null on 404 — keep that branching local rather than growing
 * this helper's surface for a single caller.
 */

// biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast at call sites
export interface ApiJsonResponse<T = any> {
  ok: boolean;
  status: number;
  json(): Promise<T>;
}

export async function fetchApiJson<T>(res: ApiJsonResponse<T>, label: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}
