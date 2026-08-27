import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schemaExports from './schema/index.js';

/**
 * Creates a Drizzle client connected to pgbouncer in transaction-pooling mode.
 *
 * IMPORTANT: The URL MUST point to pgbouncer (default port 6432), NOT Postgres directly.
 * Using the direct Postgres URL here will cause connection exhaustion under load.
 *
 * pgbouncer transaction mode constraints:
 * - `prepare: false` is REQUIRED — server-side prepared statements are NOT supported in
 *   transaction pooling mode because each transaction may be routed to a different backend.
 * - Do NOT use SET outside a transaction.
 * - Do NOT use LISTEN/NOTIFY.
 * - Do NOT hold advisory locks across statements.
 * - Do NOT pass `connection: {...}` options. Those become startup parameters, and
 *   pgbouncer rejects any it cannot track:
 *
 *     WARNING unsupported startup parameter: statement_timeout=15000
 *     LOG     closing because: unsupported startup parameter (age=0s)
 *
 *   It closes the socket during the handshake, so EVERY query fails and the API
 *   surfaces a 500 on every DB-backed route. This took the public portfolio, the
 *   blog API, /rss.xml and the sitemap's post list down simultaneously.
 *
 * statement_timeout is still enforced — it is set on the database itself (see
 * migration 0004), which survives connection pooling because pgbouncer's server
 * connections inherit it. Setting it here looked equivalent and was not: the
 * startup-parameter route is the one shape pgbouncer refuses.
 *
 * @param url - pgbouncer connection URL (DATABASE_URL env var)
 */
export function createClient(url: string) {
  const sql = postgres(url, {
    max: 10,
    prepare: false, // REQUIRED for pgbouncer transaction mode
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(sql, {
    schema: schemaExports.schema,
    logger: process.env.NODE_ENV === 'development',
  });
}

export type DbClient = ReturnType<typeof createClient>;
