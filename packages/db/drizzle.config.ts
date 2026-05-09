import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  schema: './src/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Use direct Postgres URL for drizzle-kit operations (generate, studio, push)
    // NOT the pgbouncer URL — drizzle-kit needs session-level access
    url: process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
