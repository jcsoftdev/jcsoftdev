import { join } from 'node:path';
import { purgeExpiredRooms } from '../application/rooms';
import { runMigrations } from './migrations';
import { getContext } from './runtime';

const PURGE_INTERVAL_MILLISECONDS = 60 * 60 * 1000;

function purgeQuietly(): void {
  purgeExpiredRooms(getContext()).catch((error: unknown) => {
    console.error('Purge failed', error instanceof Error ? error.name : 'unknown');
  });
}

export async function startBackgroundJobs(): Promise<void> {
  const directUrl = process.env.DATABASE_DIRECT_URL;
  if (directUrl) await runMigrations(directUrl, join(process.cwd(), 'migrations'));
  purgeQuietly();
  setInterval(purgeQuietly, PURGE_INTERVAL_MILLISECONDS).unref();
}
