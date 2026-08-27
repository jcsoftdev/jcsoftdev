/**
 * Sync integration test — Testcontainers Postgres 17.
 *
 * `runSeed` uses ON CONFLICT DO NOTHING, so it can only ever ADD rows: once a
 * database has been seeded, rewriting `data.ts` changes nothing in it. `syncSeedData`
 * is the counterpart that makes an already-seeded database match `data.ts` again —
 * it overwrites the seed-managed rows and prunes the ones a previous seed left behind.
 *
 * Verifies:
 * 1. Sync overwrites an existing row whose content drifted from data.ts
 * 2. Sync removes superseded project slugs from an earlier seed
 * 3. Sync removes experience rows past the current displayOrder range
 * 4. Sync leaves rows it does not manage alone (admin-authored projects, posts)
 * 5. Sync is idempotent — running twice yields identical counts
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
import { seedExperiences, seedProjects } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'migrations');

describe.sequential('sync.integration', { timeout: 120_000 }, () => {
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();

    sql = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(sql);

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    // Reproduce the state a pre-CV-alignment database is actually in: rows the
    // old seed wrote, under slugs and display orders data.ts no longer exports.
    await sql`
      INSERT INTO projects (slug, name, summary, featured_order, started_at)
      VALUES
        ('pulzifi', 'Pulzifi', 'Old seed row.', 1, '2026-01-01'),
        ('travitur-backend', 'Travitur CMS Backend', 'Old seed row.', 2, '2025-08-01'),
        ('travitur-mobile', 'Travitur Mobile App', 'Old seed row.', 3, '2025-08-01'),
        ('peru-software-pos', 'Pharmacy Point-of-Sale', 'Old seed row.', NULL, '2017-03-01'),
        ('peru-software-gas', 'Real-Time Gas Delivery Tracking', 'Old seed row.', NULL, '2017-03-01'),
        ('jcsoftdev-portfolio', 'STALE NAME', 'Stale summary.', NULL, '2026-05-01')
    `;
    await sql`
      INSERT INTO experiences (company, role, summary, started_at, ended_at, display_order)
      VALUES
        ('Pulzifi', 'Full-Stack Developer', 'Old seed row.', '2026-01-01', NULL, 1),
        ('Travitur', 'Software Developer', 'Old seed row.', '2025-08-01', '2026-01-01', 2),
        ('GlobalLogic', 'Senior Software Engineer', 'Old seed row.', '2024-11-01', '2025-08-01', 3),
        ('DD3', 'React + Node.js Developer', 'Old seed row.', '2023-10-01', '2024-11-01', 4),
        ('Globant', 'Fullstack Developer', 'Old seed row.', '2022-01-01', '2023-10-01', 5),
        ('Globant', 'Frontend Developer', 'Old seed row.', '2021-06-01', '2022-01-01', 6),
        ('IDW', 'Frontend Developer', 'Old seed row.', '2020-09-01', '2021-04-01', 7),
        ('Peru Software S.A.C', 'Full-stack Developer', 'Old seed row.', '2017-03-01', '2020-09-01', 8)
    `;

    // A row nothing in data.ts owns — sync must not touch it.
    await sql`
      INSERT INTO projects (slug, name, summary, featured_order, started_at)
      VALUES ('admin-authored', 'Admin Authored', 'Added through the admin UI.', NULL, '2026-02-01')
    `;
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
  });

  it('overwrites a seed-managed row that drifted from data.ts', async () => {
    const { syncSeedData } = await import('./sync.js');
    await syncSeedData(db);

    const result = await sql`SELECT name FROM projects WHERE slug = 'jcsoftdev-portfolio'`;
    expect(result[0]?.name).toBe('jcsoftdev Portfolio');
  });

  it('removes superseded project slugs from the earlier seed', async () => {
    const result = await sql`
      SELECT slug FROM projects
      WHERE slug IN ('pulzifi', 'travitur-backend', 'travitur-mobile', 'peru-software-pos', 'peru-software-gas')
    `;
    expect(result).toHaveLength(0);
  });

  it('removes experience rows past the current displayOrder range', async () => {
    const result = await sql`SELECT display_order FROM experiences WHERE display_order > 5`;
    expect(result).toHaveLength(0);
  });

  it('leaves the database matching data.ts exactly for managed rows', async () => {
    const projectRows = await sql`SELECT slug FROM projects ORDER BY slug`;
    const expected = [...seedProjects.map((p) => p.slug), 'admin-authored'].sort();
    expect(projectRows.map((r) => r.slug)).toEqual(expected);

    const expRows =
      await sql`SELECT company, role, display_order FROM experiences ORDER BY display_order`;
    expect(expRows).toHaveLength(seedExperiences.length);
    expect(expRows.map((r) => `${r.company}|${r.role}`)).toEqual(
      seedExperiences.map((e) => `${e.company}|${e.role}`)
    );
  });

  it('does not delete admin-authored rows it never seeded', async () => {
    const result = await sql`SELECT name FROM projects WHERE slug = 'admin-authored'`;
    expect(result[0]?.name).toBe('Admin Authored');
  });

  it('is idempotent — running twice yields identical counts', async () => {
    const { syncSeedData } = await import('./sync.js');

    const beforeProjects = await sql`SELECT COUNT(*) FROM projects`;
    const beforeExperiences = await sql`SELECT COUNT(*) FROM experiences`;

    await syncSeedData(db);

    const afterProjects = await sql`SELECT COUNT(*) FROM projects`;
    const afterExperiences = await sql`SELECT COUNT(*) FROM experiences`;

    expect(afterProjects[0]?.count).toBe(beforeProjects[0]?.count);
    expect(afterExperiences[0]?.count).toBe(beforeExperiences[0]?.count);
  });
});
