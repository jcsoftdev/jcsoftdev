/**
 * Sync script — makes an already-seeded database match `data.ts` again.
 *
 * `runSeed` uses ON CONFLICT DO NOTHING (ADR-17: admin edits must survive a
 * re-seed), which means it can only ever ADD rows. Once a database has been
 * seeded, rewriting `data.ts` changes nothing in it: the old rows stay, and any
 * row whose slug or displayOrder disappeared from `data.ts` lingers forever.
 *
 * That is exactly the state the CV alignment left behind — experience rows named
 * after client products, and project slugs that no longer exist in the seed.
 *
 * `syncSeedData` is the deliberate counterpart to that safety:
 *   1. UPSERT every seed row (ON CONFLICT DO UPDATE) — content wins over drift
 *   2. DELETE the superseded project slugs an earlier seed wrote
 *   3. DELETE experience rows past the current displayOrder range
 *
 * It does NOT touch rows it never owned — an admin-authored project keeps its
 * place, and `posts` / `media` are not in scope at all.
 *
 * CLI usage:
 *   pnpm --filter @jcsoftdev/db seed:sync                    # dev/staging
 *   pnpm --filter @jcsoftdev/db seed:sync --confirm          # production (explicit override)
 *
 * DATABASE_DIRECT_URL must be set (direct Postgres, not pgBouncer).
 */
import { gt, inArray, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { experiences, projects } from '../schema/index.js';
import { seedExperiences, seedProjects } from './data.js';

type DbClient = ReturnType<typeof drizzle>;

/**
 * Project slugs written by a previous version of `data.ts` that the current one
 * no longer exports. Listed explicitly rather than derived by "delete anything
 * not in the seed", because that rule would also delete admin-authored rows.
 *
 * These carried client product names; the CV describes the same work by what it
 * is, so the rows were renamed AND re-slugged and the originals are orphans.
 */
export const SUPERSEDED_PROJECT_SLUGS = [
  'pulzifi',
  'travitur-backend',
  'travitur-mobile',
  'peru-software-pos',
  'peru-software-gas',
] as const;

/**
 * Overwrite the seed-managed rows and prune what an earlier seed left behind.
 *
 * Runs in a single transaction: a partial sync would leave the portfolio showing
 * a mix of two different CVs.
 */
export async function syncSeedData(db: DbClient): Promise<void> {
  const maxDisplayOrder = Math.max(...seedExperiences.map((e) => e.displayOrder ?? 0));

  await db.transaction(async (tx) => {
    await tx
      .insert(projects)
      .values(seedProjects)
      .onConflictDoUpdate({
        target: projects.slug,
        set: {
          name: sql`excluded.name`,
          summary: sql`excluded.summary`,
          description: sql`excluded.description`,
          repoUrl: sql`excluded.repo_url`,
          liveUrl: sql`excluded.live_url`,
          featuredOrder: sql`excluded.featured_order`,
          startedAt: sql`excluded.started_at`,
          endedAt: sql`excluded.ended_at`,
        },
      });

    await tx
      .insert(experiences)
      .values(seedExperiences)
      .onConflictDoUpdate({
        target: experiences.displayOrder,
        set: {
          company: sql`excluded.company`,
          role: sql`excluded.role`,
          summary: sql`excluded.summary`,
          startedAt: sql`excluded.started_at`,
          endedAt: sql`excluded.ended_at`,
          location: sql`excluded.location`,
        },
      });

    await tx.delete(projects).where(inArray(projects.slug, [...SUPERSEDED_PROJECT_SLUGS]));

    // Rows with a NULL displayOrder were never seeded — leave them be.
    await tx.delete(experiences).where(gt(experiences.displayOrder, maxDisplayOrder));
  });
}

/**
 * Production guard, mirroring reset.ts (ADR-17).
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
      'seed:sync refused: NODE_ENV=production without --confirm flag. ' +
        'To sync production data, re-run with the --confirm flag: ' +
        'pnpm --filter @jcsoftdev/db seed:sync --confirm'
    );
  }
}

// CLI entry point — only runs when invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkProductionGuard();

  const { default: postgres } = await import('postgres');
  const { drizzle: drizzleClient } = await import('drizzle-orm/postgres-js');

  const url = process.env.DATABASE_DIRECT_URL;
  if (!url) {
    throw new Error(
      'DATABASE_DIRECT_URL is required for seed:sync. ' +
        'This must point to Postgres directly (port 5432), NOT pgBouncer.'
    );
  }

  const pgSql = postgres(url, { max: 1 });

  try {
    await syncSeedData(drizzleClient(pgSql));
    console.log(
      `seed:sync completed — ${seedProjects.length} projects, ${seedExperiences.length} experiences.`
    );
  } finally {
    await pgSql.end();
  }

  // Flush the Valkey portfolio cache so /api/v1/public/portfolio returns fresh
  // data. Without this the API serves the stale payload until its TTL expires.
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
