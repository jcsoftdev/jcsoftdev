// Exported for testing — resolves the Plausible analytics host from env at
// call time. Follows the ADR-16 shape (a function, not a top-level
// expression, so it's independently testable via vi.stubEnv) but — unlike
// resolveApiUrl — deliberately does NOT hard-fail in production when unset.
// Analytics is optional: a misconfigured/unset PUBLIC_PLAUSIBLE_HOST should
// silently skip the script tag, never break the page.
// PUBLIC_PLAUSIBLE_HOST is typed in src/env.d.ts (Astro-recommended pattern).
export function resolvePlausibleHost(): string | undefined {
  const host = import.meta.env.PUBLIC_PLAUSIBLE_HOST;
  return host || undefined;
}
