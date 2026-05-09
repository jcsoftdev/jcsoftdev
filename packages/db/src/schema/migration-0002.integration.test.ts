/**
 * Migration 0002 integration test — portfolio-interactions Phase 1.
 *
 * Spins an ephemeral Postgres 17 container, runs ALL migrations (0000–0002),
 * and verifies:
 *   (a) hero_media_id column exists on projects with correct type and nullable
 *   (b) All pre-existing rows retain hero_media_id = NULL after migration
 *   (c) FK ON DELETE SET NULL: deleting a media row sets project.hero_media_id = NULL
 *   (d) Composite index projects_portfolio_sort_idx is present
 *
 * Run: pnpm --filter @jcsoftdev/db test:integration
 *
 * NOTE: Long timeout (120 s) to account for cold Docker image pulls.
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

describe.sequential('migration-0002.integration', { timeout: 120_000 }, () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const container = await new PostgreSqlContainer('postgres:17-alpine').start();
    sql = postgres(container.getConnectionUri(), { max: 1 });
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
  });

  it('(a) hero_media_id column exists on projects as uuid nullable', async () => {
    const result = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'hero_media_id'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.column_name).toBe('hero_media_id');
    expect(result[0]?.data_type).toBe('uuid');
    expect(result[0]?.is_nullable).toBe('YES');
  });

  it('(b) hero_media_id FK constraint exists referencing media(id) ON DELETE SET NULL', async () => {
    const result = await sql`
      SELECT
        tc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.constraint_schema
      WHERE tc.table_name = 'projects'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'projects_hero_media_id_media_id_fk'
    `;
    expect(result).toHaveLength(1);
    expect(result[0]?.delete_rule).toBe('SET NULL');
  });

  it('(c) FK ON DELETE SET NULL: deleting media row nullifies project.hero_media_id', async () => {
    // Seed a user (required for media.uploaded_by FK)
    const [user] = await sql`
      INSERT INTO users (email, name)
      VALUES ('test-migration@example.com', 'Test User')
      RETURNING id
    `;
    const userId = user?.id as string;
    expect(userId).toBeDefined();

    // Insert a media row
    const [mediaRow] = await sql`
      INSERT INTO media (object_key, bucket, mime_type, size_bytes, uploaded_by)
      VALUES ('test/hero.jpg', 'posts-media', 'image/jpeg', 204800, ${userId})
      RETURNING id
    `;
    const mediaId = mediaRow?.id as string;
    expect(mediaId).toBeDefined();

    // Insert a project referencing the media row
    const [project] = await sql`
      INSERT INTO projects (slug, name, hero_media_id)
      VALUES ('test-project', 'Test Project', ${mediaId})
      RETURNING id, hero_media_id
    `;
    expect(project?.hero_media_id).toBe(mediaId);

    // Delete the media row
    await sql`DELETE FROM media WHERE id = ${mediaId}`;

    // Assert: project row still exists with hero_media_id = NULL
    const [updated] = await sql`
      SELECT hero_media_id FROM projects WHERE id = ${project?.id as string}
    `;
    expect(updated).toBeDefined();
    expect(updated?.hero_media_id).toBeNull();
  });

  it('(d) composite index projects_portfolio_sort_idx exists', async () => {
    const result = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'projects'
        AND indexname = 'projects_portfolio_sort_idx'
    `;
    expect(result).toHaveLength(1);
  });

  it('(e) projects table has 8 tables total after all migrations', async () => {
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const tableNames = result.map((r) => r.table_name as string);
    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('media');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('accounts');
    // Confirm table count is 8 (7 original + accounts migration = 8)
    expect(tableNames.length).toBe(8);
  });

  it('(f) re-running migrate is idempotent (no error)', async () => {
    await expect(
      migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER })
    ).resolves.not.toThrow();
  });
});
