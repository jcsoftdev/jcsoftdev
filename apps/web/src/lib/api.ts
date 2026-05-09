import type { AppType } from '@jcsoftdev/types';
import { hc } from 'hono/client';

// Exported for testing — resolves the API base URL from env at call time.
// Design §6 / ADR-16: fail-fast in prod, warn-and-default in dev.
// MODE === 'production' is canonical for both Astro and Vite environments.
// PUBLIC_API_URL is typed in src/env.d.ts (Astro-recommended pattern).
export function resolveApiUrl(): string {
  const url = import.meta.env.PUBLIC_API_URL;

  if (url) return url;

  if (import.meta.env.MODE === 'production') {
    throw new Error('PUBLIC_API_URL must be set in production builds');
  }

  console.warn('[api] PUBLIC_API_URL not set; defaulting to http://localhost:8787');
  return 'http://localhost:8787';
}

export const api = hc<AppType>(resolveApiUrl());

// RPC type probe — exported for static analysis, never called at runtime.
// Validates that AppType flows from @jcsoftdev/api → @jcsoftdev/types → @jcsoftdev/web.
// TS must know `data.message: string` without any explicit annotation.
export const __rpcProbe = async (): Promise<string> => {
  const res = await api.api.v1.hello.$get();
  const data = await res.json();
  // If AppType is wired correctly, TS infers data.message as string.
  return data.message.toUpperCase();
};
