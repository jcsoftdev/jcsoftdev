import { Redis } from 'iovalkey';

/**
 * Thin wrapper over iovalkey (Valkey-native, ioredis-compatible client).
 *
 * Exposes only the subset of operations the API needs:
 *   get    — retrieve a cached value (returns null on miss)
 *   set    — store a value, optionally with a TTL in seconds
 *   del    — delete a key, returns count of deleted keys
 *
 * Design decision: we don't expose the raw redis instance so callers
 * cannot accidentally bypass the interface or use session-unsafe commands
 * (SUBSCRIBE, LISTEN, etc.) that break under pgBouncer transaction mode.
 * (Valkey itself supports those, but our usage should stay simple.)
 */
export interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<string | null>;
  del(key: string): Promise<number>;
}

/**
 * Create a ValkeyClient backed by iovalkey.
 *
 * @param url - Redis/Valkey connection URL (e.g. redis://localhost:6379)
 * @returns ValkeyClient instance
 */
export function createValkeyClient(url: string): ValkeyClient {
  const redis = new Redis(url);

  return {
    async get(key: string): Promise<string | null> {
      return redis.get(key);
    },

    async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
      if (ttlSeconds !== undefined) {
        return redis.set(key, value, 'EX', ttlSeconds);
      }
      return redis.set(key, value);
    },

    async del(key: string): Promise<number> {
      return redis.del(key);
    },
  };
}
