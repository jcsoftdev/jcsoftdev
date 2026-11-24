import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/schema.ts',
  out: './migrations',
  schemaFilter: ['sorteo_regalos'],
  migrations: { schema: 'sorteo_regalos', table: 'migrations' },
});
