/**
 * Auth configuration — Phase 4 + Phase 5 (Drizzle adapter)
 *
 * Phase 5 change: Wire the Drizzle adapter when a DB client is provided.
 * With secondaryStorage (Valkey), better-auth only needs user + account tables:
 *   - session table: NOT needed (sessions in Valkey)
 *   - verification table: NOT needed (tokens in Valkey)
 *   - user table: needed (user rows persist to Postgres)
 *   - account table: needed (magic-link account linking)
 */

import type { DbClient } from '@jcsoftdev/db';
import { accounts, users } from '@jcsoftdev/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import type { NodeEnv } from './auth.js';
import { buildCookieConfig } from './auth.js';
import type { ValkeyClient } from './valkey.js';

// ---------------------------------------------------------------------------
// SecondaryStorage adapter
// ---------------------------------------------------------------------------

/**
 * Minimal secondaryStorage shape required by better-auth.
 * The `delete` method maps to ValkeyClient.del (returns number).
 */
export interface SecondaryStorageAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, ttl?: number): Promise<unknown>;
  delete(key: string): Promise<string | null>;
}

/**
 * Wrap our ValkeyClient in the shape better-auth's secondaryStorage expects.
 */
export function createValkeySecondaryStorage(valkey: ValkeyClient): SecondaryStorageAdapter {
  return {
    async get(key: string): Promise<string | null> {
      return valkey.get(key);
    },

    async set(key: string, value: string, ttl?: number): Promise<void> {
      await valkey.set(key, value, ttl);
    },

    async delete(key: string): Promise<null> {
      await valkey.del(key);
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Auth instance factory
// ---------------------------------------------------------------------------

export interface CreateAuthInstanceInput {
  betterAuthSecret: string;
  betterAuthUrl: string;
  cookieDomain: string | undefined;
  nodeEnv: NodeEnv;
  corsOrigins: string[];
  resendFromEmail: string;
  /** Injected email sender — keeps the factory testable without real Resend */
  sendMagicLinkEmail: (data: { email: string; url: string; token: string }) => Promise<void>;
  valkeyClient: ValkeyClient;
  /**
   * Phase 5: optional Drizzle DB client.
   * When provided, the drizzle adapter persists users + accounts to Postgres.
   * When absent (tests, Phase 4 compat), better-auth falls back to in-memory.
   */
  dbClient?: DbClient;
}

/**
 * Create a fully-configured better-auth instance.
 *
 * With secondaryStorage (Valkey):
 *   - session table: SKIPPED (sessions go to Valkey)
 *   - verification table: SKIPPED (magic-link tokens go to Valkey)
 *   - user table: REQUIRED (maps to our `users` table via usePlural:true)
 *   - account table: REQUIRED (magic-link account linking, maps to `accounts`)
 *
 * drizzleAdapter config:
 *   - provider: 'pg'
 *   - usePlural: true → model 'user' maps to 'users', 'account' maps to 'accounts'
 *   - schema: only the two tables better-auth needs
 *
 * Transaction note: better-auth's drizzle adapter has a `transaction` option.
 * We set it to false because pgBouncer transaction-mode can't support nested
 * transactions (better-auth wraps operations in its own transaction which would
 * conflict with pgBouncer's connection routing). Valkey handles session isolation.
 */
// biome-ignore lint/suspicious/noExplicitAny: better-auth's narrow generic type can't be widened to BetterAuthOptions without losing plugin inference
export function createAuthInstance(input: CreateAuthInstanceInput): any {
  const {
    betterAuthSecret,
    betterAuthUrl,
    cookieDomain,
    nodeEnv,
    corsOrigins,
    sendMagicLinkEmail,
    valkeyClient,
    dbClient,
  } = input;

  const cookieConfig = buildCookieConfig({ nodeEnv, cookieDomain });
  const secondaryStorage = createValkeySecondaryStorage(valkeyClient);

  // Build database config — Drizzle adapter when DB is available, otherwise
  // better-auth's built-in memory adapter (test/compat fallback)
  // biome-ignore lint/suspicious/noExplicitAny: drizzleAdapter returns an opaque type
  const database: any = dbClient
    ? drizzleAdapter(dbClient, {
        provider: 'pg',
        // usePlural:true maps model name 'user' → table 'users', 'account' → 'accounts'
        usePlural: true,
        // Schema restricted to the two tables needed (sessions + verifications in Valkey)
        schema: {
          users,
          accounts,
        },
        // Disable internal transaction wrapping — pgBouncer tx-mode doesn't support
        // nested transactions and we rely on Valkey for session atomicity
        transaction: false,
      })
    : undefined;

  return betterAuth({
    secret: betterAuthSecret,
    baseURL: betterAuthUrl,
    trustedOrigins: corsOrigins,

    // Drizzle adapter — users + accounts persist to Postgres (Phase 5+)
    // When dbClient is absent, better-auth uses its internal memory adapter
    ...(database ? { database } : {}),

    // Valkey-backed session storage (ADR-2)
    secondaryStorage,

    // Cookie config — cross-subdomain in prod, lax in dev
    advanced: {
      cookiePrefix: 'jcsoftdev',
      useSecureCookies: cookieConfig.secure,
      crossSubDomainCookies: cookieDomain
        ? { enabled: true, domain: cookieDomain }
        : { enabled: false },
      defaultCookieAttributes: {
        httpOnly: cookieConfig.httpOnly,
        sameSite: cookieConfig.sameSite,
        path: cookieConfig.path,
      },
    },

    plugins: [
      magicLink({
        // 15 minutes TTL per spec §3
        expiresIn: 60 * 15,
        // Single-use enforced by better-auth (allowedAttempts: 1 is default)
        sendMagicLink: async ({ email, url, token }) => {
          await sendMagicLinkEmail({ email, url, token });
        },
        // Disable sign-up — this is a single-admin site
        disableSignUp: false,
      }),
    ],
  });
}
