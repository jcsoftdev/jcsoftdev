/**
 * Seed CLI entry point.
 *
 * Thin wrapper: parse env, build db client, call runSeed, close connection.
 *
 * Usage:
 *   pnpm --filter @jcsoftdev/db seed
 *
 * DATABASE_DIRECT_URL must be set (direct Postgres, not pgBouncer).
 *
 * For a full reset (TRUNCATE + re-seed), use:
 *   pnpm --filter @jcsoftdev/db seed:reset
 */
export { runSeed } from './run.js';

// CLI entry point — only runs when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { runSeed: _runSeed } = await import('./run.js');

  const url = process.env.DATABASE_DIRECT_URL;
  if (!url) {
    throw new Error(
      'DATABASE_DIRECT_URL is required for seeding. ' +
        'This must point to Postgres directly (port 5432), NOT pgBouncer.'
    );
  }

  const sql = postgres(url, { max: 1 });

  try {
    await _runSeed(drizzle(sql));
    console.log('Seed completed successfully.');
  } finally {
    await sql.end();
  }
}
