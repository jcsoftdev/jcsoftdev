/**
 * fetchApiJson — shared "assert ok, then parse JSON" for Hono RPC client
 * responses. portfolio-fetch.ts and blog-fetch.ts each repeated an identical
 * `if (!res.ok) throw new Error(...)` dance for every public API call; this
 * collapses that to one call site.
 *
 * The parameter is intentionally the structural subset of ClientResponse
 * rather than ClientResponse<T> itself: hc<AppType> types a route that can
 * answer 400 as a union of success and error responses, and only the ok
 * branch matches T. Narrowing on `ok` happens here, once, so callers pass the
 * union straight through without a cast.
 *
 * Deliberately does NOT special-case any status (e.g. 404). Callers with
 * different-than-"throw" semantics — like blog-fetch.ts's fetchBlogPost,
 * which returns null on 404 — keep that branching local rather than growing
 * this helper's surface for a single caller.
 */

export interface ApiJsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export async function fetchApiJson<T>(res: ApiJsonResponse, label: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}
