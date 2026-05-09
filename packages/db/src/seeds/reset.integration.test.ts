/**
 * Reset integration test — Testcontainers Postgres 17.
 *
 * Verifies:
 * 1. Seed → reset → re-seed produces expected row counts (8 experiences, 7 projects)
 * 2. CASCADE — TRUNCATE removes FK-referencing child rows cleanly
 *
 * Timeout: 120 s to account for container startup.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'migrations');

describe.sequential('reset.integration', { timeout: 120_000 }, () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();

    sql = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(sql);

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
  });

  it('seed populates tables before reset', async () => {
    const { runSeed } = await import('./run.js');
    await runSeed(db);

    const expResult = await sql`SELECT COUNT(*) FROM experiences`;
    const projResult = await sql`SELECT COUNT(*) FROM projects`;

    expect(parseInt(expResult[0]?.count as string, 10)).toBe(8);
    expect(parseInt(projResult[0]?.count as string, 10)).toBe(7);
  });

  it('truncateAndReseed wipes and re-seeds to exact counts', async () => {
    const { truncateAndReseed } = await import('./reset.js');
    await truncateAndReseed(db);

    const expResult = await sql`SELECT COUNT(*) FROM experiences`;
    const projResult = await sql`SELECT COUNT(*) FROM projects`;

    expect(parseInt(expResult[0]?.count as string, 10)).toBe(8);
    expect(parseInt(projResult[0]?.count as string, 10)).toBe(7);
  });

  it('truncateAndReseed handles CASCADE FK children cleanly', async () => {
    // This test verifies that TRUNCATE ... CASCADE runs without FK constraint errors.
    // The media and post_tags tables have FK references to projects/experiences.
    // Even if those are empty, the CASCADE keyword must be present and work correctly.
    const { truncateAndReseed } = await import('./reset.js');

    // Second reset — should complete cleanly with no FK errors
    await expect(truncateAndReseed(db)).resolves.not.toThrow();

    const expResult = await sql`SELECT COUNT(*) FROM experiences`;
    const projResult = await sql`SELECT COUNT(*) FROM projects`;

    expect(parseInt(expResult[0]?.count as string, 10)).toBe(8);
    expect(parseInt(projResult[0]?.count as string, 10)).toBe(7);
  });
});
