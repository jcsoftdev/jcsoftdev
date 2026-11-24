import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { MIGRATIONS_TABLE, SCHEMA_NAME } from './schema';

export async function runMigrations(directUrl: string, migrationsFolder: string): Promise<void> {
  const client = postgres(directUrl, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(client), {
      migrationsFolder,
      migrationsSchema: SCHEMA_NAME,
      migrationsTable: MIGRATIONS_TABLE,
    });
  } finally {
    await client.end();
  }
}
