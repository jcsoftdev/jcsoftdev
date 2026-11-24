import { runMigrations } from './migrations';

const directUrl = process.env.DATABASE_DIRECT_URL;
if (!directUrl) {
  console.error('DATABASE_DIRECT_URL is required');
  process.exit(1);
}

await runMigrations(directUrl, 'migrations');
console.log('Migrations applied');
