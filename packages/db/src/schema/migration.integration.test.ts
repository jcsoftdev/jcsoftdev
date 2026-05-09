/**
 * Migration integration test — spins an ephemeral Postgres 17 container via
 * Testcontainers, runs the Drizzle migration, and asserts all 7 tables + the
 * citext extension are present.
 *
 * NOTE: This test is marked with a long timeout (120 s) because container pull
 * + startup can take 30–60 s on a cold machine. On warm machines (image cached)
 * it typically completes in <15 s.
 *
 * Run: vitest run src/schema/migration.integration.test.ts
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

describe.sequential('migration.integration', { timeout: 120_000 }, () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();

    sql = postgres(container.getConnectionUri(), { max: 1 });

    // Run migrations
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
  });

  it('citext extension is enabled', async () => {
    const result = await sql`
      SELECT extname FROM pg_extension WHERE extname = 'citext'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.extname).toBe('citext');
  });

  it('all 7 tables exist after migration', async () => {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const tableNames = result.map((r) => r.table_name as string);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('media');
    expect(tableNames).toContain('posts');
    expect(tableNames).toContain('tags');
    expect(tableNames).toContain('post_tags');
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('experiences');
    // 7 original tables + accounts (added in 0001_sharp_silver_samurai) = 8
    expect(tableNames).toHaveLength(8);
  });

  it('post_status enum exists', async () => {
    const result = await sql`
      SELECT typname FROM pg_type WHERE typname = 'post_status'
    `;
    expect(result).toHaveLength(1);
  });

  it('drizzle migration journal schema exists and has one entry', async () => {
    // Drizzle stores migration history in the 'drizzle' schema, not 'public'
    const schemas = await sql`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drizzle'
    `;
    expect(schemas).toHaveLength(1);
    // Verify at least one migration entry was recorded
    const migrations = await sql`
      SELECT "hash" FROM "drizzle"."__drizzle_migrations" ORDER BY "created_at"
    `;
    expect(migrations.length).toBeGreaterThanOrEqual(1);
  });
});
