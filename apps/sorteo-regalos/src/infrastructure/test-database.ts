import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { AppContext } from '../application/context';
import { createSealer, developmentKey } from '../application/security';
import type { Db } from './database';
import { createDrizzleStore } from './drizzle-store';
import * as schema from './schema';
import { MIGRATIONS_TABLE, SCHEMA_NAME } from './schema';

export interface TestContext extends AppContext {
  readonly clock: { current: Date };
}

export async function createTestContext(random: () => number = Math.random): Promise<TestContext> {
  const database = drizzle(new PGlite(), { schema });
  await migrate(database, {
    migrationsFolder: 'migrations',
    migrationsSchema: SCHEMA_NAME,
    migrationsTable: MIGRATIONS_TABLE,
  });
  const clock = { current: new Date('2026-11-23T12:00:00Z') };
  return {
    store: createDrizzleStore(database as unknown as Db),
    sealer: createSealer(developmentKey()),
    now: () => clock.current,
    random,
    clock,
  };
}
