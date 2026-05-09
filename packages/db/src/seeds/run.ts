/**
 * Seed runner for jcsoftdev portfolio data.
 *
 * Exports `runSeed(db)` — inserts all seed data using ON CONFLICT DO NOTHING.
 * Idempotent: safe to call multiple times without duplicating rows.
 *
 * Conflict targets:
 * - projects.slug      (citext unique constraint)
 * - experiences.displayOrder (integer unique constraint)
 */
import type { drizzle } from 'drizzle-orm/postgres-js';
import { experiences, projects } from '../schema/index.js';
import { seedExperiences, seedProjects } from './data.js';

type DbClient = ReturnType<typeof drizzle>;

export async function runSeed(db: DbClient): Promise<void> {
  await db.insert(projects).values(seedProjects).onConflictDoNothing({ target: projects.slug });
  await db
    .insert(experiences)
    .values(seedExperiences)
    .onConflictDoNothing({ target: experiences.displayOrder });
}
