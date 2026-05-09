/**
 * Reset script for jcsoftdev seed data.
 *
 * Exports:
 * - `checkProductionGuard()` — throws if NODE_ENV=production without --confirm flag (ADR-17)
 * - `truncateAndReseed(db)` — TRUNCATE + CASCADE + runSeed (testable without CLI)
 *
 * CLI usage:
 *   pnpm --filter @jcsoftdev/db seed:reset                    # dev/staging
 *   pnpm --filter @jcsoftdev/db seed:reset --confirm          # production (explicit override)
 *
 * DATABASE_DIRECT_URL must be set (direct Postgres, not pgBouncer).
 */
import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { runSeed } from './run.js';

type DbClient = ReturnType<typeof drizzle>;

/**
 * Production guard per ADR-17.
 *
 * Rules:
 * - If NODE_ENV === 'production' AND '--confirm' flag is NOT present → throws.
 * - Any other combination → does not throw (safe to proceed).
 */
export function checkProductionGuard(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasConfirm = process.argv.includes('--confirm');

  if (isProduction && !hasConfirm) {
    throw new Error(
      'seed:reset refused: NODE_ENV=production without --confirm flag. ' +
        'To reset production data, re-run with the --confirm flag: ' +
        'pnpm --filter @jcsoftdev/db seed:reset --confirm'
    );
  }
}

/**
 * TRUNCATE all seed-managed tables with CASCADE then re-run the seed.
 *
 * Tables truncated (order within CASCADE does not matter):
 *   post_tags, projects, experiences, media
 *
 * RESTART IDENTITY resets all sequences so auto-increment IDs restart from 1.
 * CASCADE handles FK-referencing child rows in other tables.
 *
 * NOTE: The `posts` table is intentionally NOT truncated — blog content is
 * admin-authored, not seeded, and must survive a seed reset.
 */
export async function truncateAndReseed(db: DbClient): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE post_tags, projects, experiences, media RESTART IDENTITY CASCADE`
  );
  await runSeed(db);
}

// CLI entry point — only runs when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkProductionGuard();

  const { default: postgres } = await import('postgres');
  const { drizzle: drizzleClient } = await import('drizzle-orm/postgres-js');

  const url = process.env.DATABASE_DIRECT_URL;
  if (!url) {
    throw new Error(
      'DATABASE_DIRECT_URL is required for seed:reset. ' +
        'This must point to Postgres directly (port 5432), NOT pgBouncer.'
    );
  }

  const pgSql = postgres(url, { max: 1 });

  try {
    await truncateAndReseed(drizzleClient(pgSql));
    console.log('seed:reset completed successfully.');
  } finally {
    await pgSql.end();
  }

  // Flush Valkey portfolio cache so /api/v1/public/portfolio returns fresh data.
  // Without this, the API serves stale cached payload (TTL 5min) until expiry.
  const valkeyUrl = process.env.VALKEY_URL;
  if (valkeyUrl) {
    try {
      const { Redis } = await import('iovalkey');
      const valkey = new Redis(valkeyUrl);
      const deleted = await valkey.del('public:portfolio:v1');
      await valkey.quit();
      console.log(
        deleted > 0
          ? 'Valkey cache flushed (public:portfolio:v1).'
          : 'Valkey cache key not present — nothing to flush.'
      );
    } catch (err) {
      console.warn('Could not flush Valkey cache:', err instanceof Error ? err.message : err);
    }
  }
}
