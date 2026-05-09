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
