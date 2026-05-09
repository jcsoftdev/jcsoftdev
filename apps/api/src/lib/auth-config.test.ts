import { describe, expect, it, vi } from 'vitest';
import { createAuthInstance, createValkeySecondaryStorage } from './auth-config.js';

// ---------------------------------------------------------------------------
// Fake in-memory Valkey for secondaryStorage adapter tests
// ---------------------------------------------------------------------------
type StoreEntry = { value: string; expiresAt: number } | { value: string };

function makeFakeValkey() {
  const store = new Map<string, StoreEntry>();
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if ('expiresAt' in entry && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, ttlSeconds?: number) => {
      if (ttlSeconds !== undefined) {
        store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      } else {
        store.set(key, { value });
      }
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    // Expose store for inspection in tests
    _store: store,
  };
}

describe('createValkeySecondaryStorage', () => {
  it('get returns null on miss', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    const result = await storage.get('nonexistent-key');
    expect(result).toBeNull();
  });

  it('set then get returns the stored value', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    await storage.set('session:abc', JSON.stringify({ userId: '123' }), 3600);
    const result = await storage.get('session:abc');
    expect(result).toBe(JSON.stringify({ userId: '123' }));
  });

  it('set calls underlying valkey with ttl when provided', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    await storage.set('key', 'value', 900);
    expect(fakeValkey.set).toHaveBeenCalledWith('key', 'value', 900);
  });

  it('set calls underlying valkey without ttl when not provided', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    await storage.set('key', 'value');
    expect(fakeValkey.set).toHaveBeenCalledWith('key', 'value', undefined);
  });

  it('delete removes the key', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    await storage.set('del-key', 'del-value', 3600);
    await storage.delete('del-key');
    expect(fakeValkey.del).toHaveBeenCalledWith('del-key');
    const result = await storage.get('del-key');
    expect(result).toBeNull();
  });

  it('delete is a no-op on nonexistent key', async () => {
    const fakeValkey = makeFakeValkey();
    const storage = createValkeySecondaryStorage(fakeValkey);
    await expect(storage.delete('ghost-key')).resolves.not.toThrow();
  });
});

describe('createAuthInstance', () => {
  it('creates a better-auth instance with a handler function', () => {
    const fakeValkey = makeFakeValkey();
    const auth = createAuthInstance({
      betterAuthSecret: 'a'.repeat(32),
      betterAuthUrl: 'http://localhost:3000',
      cookieDomain: undefined,
      nodeEnv: 'test',
      corsOrigins: ['http://localhost:4321'],
      resendFromEmail: 'noreply@test.com',
      sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
      valkeyClient: fakeValkey,
    });
    expect(typeof auth.handler).toBe('function');
  });

  it('creates an instance with the magic-link plugin loaded (api.signInMagicLink exists)', () => {
    const fakeValkey = makeFakeValkey();
    // biome-ignore lint/suspicious/noExplicitAny: testing runtime plugin injection
    const auth: any = createAuthInstance({
      betterAuthSecret: 'b'.repeat(32),
      betterAuthUrl: 'http://localhost:3000',
      cookieDomain: undefined,
      nodeEnv: 'test',
      corsOrigins: ['http://localhost:4321'],
      resendFromEmail: 'noreply@test.com',
      sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
      valkeyClient: fakeValkey,
    });
    // The magic-link plugin injects signInMagicLink into the api
    expect(typeof auth.api.signInMagicLink).toBe('function');
  });

  it('calls sendMagicLinkEmail when better-auth sends a magic link', async () => {
    const sendMagicLinkEmail = vi.fn().mockResolvedValue(undefined);
    const fakeValkey = makeFakeValkey();
    const auth = createAuthInstance({
      betterAuthSecret: 'c'.repeat(32),
      betterAuthUrl: 'http://localhost:3000',
      cookieDomain: undefined,
      nodeEnv: 'test',
      corsOrigins: ['http://localhost:4321'],
      resendFromEmail: 'noreply@test.com',
      sendMagicLinkEmail,
      valkeyClient: fakeValkey,
    });
    // Trigger the sign-in magic link flow via the API
    const req = new Request('http://localhost:3000/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jcsoftdev.com' }),
    });
    const res = await auth.handler(req);
    // Better-auth may return 200 or 201 after queuing the magic link
    expect(res.status).toBeLessThan(500);
    expect(sendMagicLinkEmail).toHaveBeenCalledOnce();
    const callArg = sendMagicLinkEmail.mock.calls[0]?.[0] as { email: string } | undefined;
    expect(callArg?.email).toBe('admin@jcsoftdev.com');
  });
});
