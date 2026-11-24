import type { AppContext } from '../application/context';
import { createSealer, developmentKey, secureRandom } from '../application/security';
import { createDatabase } from './database';
import { createDrizzleStore } from './drizzle-store';

const globalCache = globalThis as typeof globalThis & { sorteoContext?: AppContext };

function assignmentKey(): string {
  const configured = process.env.ASSIGNMENT_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('ASSIGNMENT_KEY is required');
  return developmentKey();
}

function buildContext(): AppContext {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  return {
    store: createDrizzleStore(createDatabase(url)),
    sealer: createSealer(assignmentKey()),
    now: () => new Date(),
    random: secureRandom,
  };
}

export function getContext(): AppContext {
  globalCache.sorteoContext ??= buildContext();
  return globalCache.sorteoContext;
}
