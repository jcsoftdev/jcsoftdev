/**
 * Auth placeholder — Phase 2
 *
 * This module provides:
 *   1. `buildCookieConfig` — env-driven cookie configuration helper used by
 *      better-auth in Phase 4. Extracted here so it can be unit-tested
 *      independently of the better-auth library.
 *   2. Type stubs for the auth instance shape that Phase 4 will fill in.
 *
 * Phase 4 will:
 *   - Install `better-auth` and the magic-link plugin
 *   - Replace the `createAuth` stub with the real factory
 *   - Wire the Valkey adapter for session storage
 *   - Mount the handler on `/auth/*` in app.ts
 *
 * DO NOT import `better-auth` here until Phase 4.
 */

export type NodeEnv = 'development' | 'test' | 'production';

export interface CookieConfig {
  /** Sent with every response — must be true in prod per spec */
  httpOnly: boolean;
  /** Path scope for the cookie */
  path: string;
  /** Domain scope — undefined in dev (no Domain attribute), '.jcsoftdev.com' in prod */
  domain?: string;
  /** SameSite attribute — 'none' in prod (cross-subdomain), 'lax' in dev/test */
  sameSite: 'none' | 'lax' | 'strict';
  /** Secure flag — required when sameSite='none'; always true in prod */
  secure: boolean;
}

export interface BuildCookieConfigInput {
  nodeEnv: NodeEnv;
  cookieDomain: string | undefined;
}

/**
 * Compute the cookie config based on the current environment.
 *
 * Production:
 *   Domain=<COOKIE_DOMAIN>; SameSite=None; Secure; HttpOnly; Path=/
 *   Required for cross-subdomain cookie sharing (admin.jcsoftdev.com ↔ api.jcsoftdev.com).
 *
 * Development / test:
 *   SameSite=Lax; HttpOnly; Path=/   (no Domain, no Secure)
 *   Secure=false is intentional — localhost does not use TLS.
 *
 * Config values are passed into better-auth's cookieOptions in Phase 4.
 * No logic decisions are baked in here — the caller supplies env values.
 */
export function buildCookieConfig({ nodeEnv, cookieDomain }: BuildCookieConfigInput): CookieConfig {
  const isProduction = nodeEnv === 'production';

  const base = {
    httpOnly: true as const,
    path: '/',
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    secure: isProduction,
  };

  // exactOptionalPropertyTypes: don't assign undefined to optional property;
  // instead omit the key entirely when there's no domain.
  if (isProduction && cookieDomain !== undefined) {
    return { ...base, domain: cookieDomain };
  }
  return base;
}

/**
 * Auth instance shape — placeholder until Phase 4 installs better-auth.
 *
 * Phase 4 will replace this with the real type from better-auth.
 * Consumers should import the type from here so their type signatures
 * don't need to change when Phase 4 fills in the implementation.
 */
export interface AuthInstance {
  handler: (request: Request) => Promise<Response>;
}

/**
 * Placeholder factory — throws at call time if invoked before Phase 4.
 *
 * This ensures that Phase 5 route mounts fail loudly at startup
 * rather than silently returning undefined or crashing at request time.
 */
export function createAuth(_env: {
  betterAuthSecret: string;
  betterAuthUrl: string;
  cookieDomain?: string;
  nodeEnv: NodeEnv;
  corsOrigins: string[];
}): AuthInstance {
  throw new Error(
    'createAuth is not yet implemented. Install better-auth in Phase 4 and replace this stub.'
  );
}
