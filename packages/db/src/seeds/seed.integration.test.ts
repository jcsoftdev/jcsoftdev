/**
 * Seed integration test — Testcontainers Postgres 17.
 *
 * Verifies:
 * 1. Exact row counts after first seed (5 experiences, 8 projects, 5 featured)
 * 2. Idempotency — running twice does not change row counts (ON CONFLICT DO NOTHING)
 * 3. Admin-edit survival — ON CONFLICT DO NOTHING does NOT overwrite existing rows
 *
 * Timeout: 120 s to account for container startup on cold machines.
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

describe.sequential('seed.integration', { timeout: 120_000 }, () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();

    sql = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(sql);

    // Run migrations first
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
  });

  it('seed populates exactly 5 experience rows', async () => {
    const { runSeed } = await import('./run.js');
    await runSeed(db);

    const result = await sql`SELECT COUNT(*) FROM experiences`;
    const count = parseInt(result[0]?.count as string, 10);
    expect(count).toBe(5);
  });

  it('seed populates exactly 8 project rows', async () => {
    const result = await sql`SELECT COUNT(*) FROM projects`;
    const count = parseInt(result[0]?.count as string, 10);
    expect(count).toBe(8);
  });

  it('seed populates exactly 5 featured projects', async () => {
    const result = await sql`SELECT COUNT(*) FROM projects WHERE featured_order IS NOT NULL`;
    const count = parseInt(result[0]?.count as string, 10);
    expect(count).toBe(5);
  });

  it('featured projects have featuredOrder 1..5 in CV order', async () => {
    const result =
      await sql`SELECT slug, featured_order FROM projects WHERE featured_order IS NOT NULL ORDER BY featured_order`;
    expect(result.map((r) => r.slug)).toEqual([
      'multi-tenant-monitoring-saas',
      'cms-google-drive-backend',
      'companion-mobile-app',
      'enterprise-microservices-platform',
      'microfrontend-web-platform',
    ]);
    expect(result.map((r) => r.featured_order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('seed is idempotent — running twice does not change row count', async () => {
    const { runSeed } = await import('./run.js');

    const beforeProjects = await sql`SELECT COUNT(*) FROM projects`;
    const beforeExperiences = await sql`SELECT COUNT(*) FROM experiences`;

    // Run seed a second time — ON CONFLICT DO NOTHING should skip all rows
    await runSeed(db);

    const afterProjects = await sql`SELECT COUNT(*) FROM projects`;
    const afterExperiences = await sql`SELECT COUNT(*) FROM experiences`;

    expect(afterProjects[0]?.count).toBe(beforeProjects[0]?.count);
    expect(afterExperiences[0]?.count).toBe(beforeExperiences[0]?.count);
  });

  it('admin edits survive re-seed (ON CONFLICT DO NOTHING does not overwrite)', async () => {
    const { runSeed } = await import('./run.js');

    // Simulate an admin renaming a project
    await sql`UPDATE projects SET name = 'Renamed by admin' WHERE slug = 'multi-tenant-monitoring-saas'`;

    // Re-run seed — should NOT overwrite the admin edit
    await runSeed(db);

    const result = await sql`SELECT name FROM projects WHERE slug = 'multi-tenant-monitoring-saas'`;
    expect(result[0]?.name).toBe('Renamed by admin');
  });
});
