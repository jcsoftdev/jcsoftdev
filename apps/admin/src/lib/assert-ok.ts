/**
 * assertOkJson — shared "assert 2xx, then parse JSON" for Hono RPC client
 * responses in the admin SPA.
 *
 * `fetch` only rejects on network failure, so an errored response (401, 404,
 * 500) resolves normally and its `{ error: "..." }` body parses cleanly as the
 * success type. Without this check a TanStack Query `queryFn` never enters its
 * error state: list views render their empty state on an auth failure, detail
 * views hand a form an object with every field undefined, and the `isError`
 * branch is unreachable for anything short of a dropped connection.
 *
 * Lives in its own module rather than in api.ts because api.ts constructs the
 * Hono client at import time — tests mock that module wholesale, which would
 * stub this helper out along with it. Mirrors apps/web's fetch-api-json.ts.
 */

/** The subset of `Response` this helper needs — keeps test fakes small. */
export interface OkJsonResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

export async function assertOkJson<T>(res: OkJsonResponse, label: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load ${label}: HTTP ${res.status ?? 'unknown'}`);
  }
  return (await res.json()) as T;
}
