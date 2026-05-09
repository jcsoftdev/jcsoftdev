/**
 * Programmatic migrations runner.
 *
 * CRITICAL: This connects directly to Postgres (DATABASE_DIRECT_URL), NOT pgbouncer.
 * Schema migrations require session-level guarantees that pgbouncer transaction mode breaks.
 *
 * DATABASE_DIRECT_URL format: postgres://user:pass@localhost:5432/jcsoft
 * DATABASE_URL (pgbouncer) format: postgres://user:pass@localhost:6432/jcsoft
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_DIRECT_URL;
if (!url) {
  throw new Error(
    'DATABASE_DIRECT_URL is required for migrations. ' +
      'This must point to Postgres directly (port 5432), NOT pgbouncer.'
  );
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '..', 'migrations');

const sql = postgres(url, { max: 1 });

try {
  await migrate(drizzle(sql), { migrationsFolder });
  console.log('Migrations completed successfully.');
} finally {
  await sql.end();
}
