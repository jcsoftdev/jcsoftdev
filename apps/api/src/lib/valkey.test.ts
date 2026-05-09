import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Shared mock methods — we capture references before the mock factory runs
const mockGet = vi.fn().mockResolvedValue(null);
const mockSet = vi.fn().mockResolvedValue('OK');
const mockDel = vi.fn().mockResolvedValue(1);
const mockQuit = vi.fn().mockResolvedValue('OK');
const mockOn = vi.fn();

// We mock the iovalkey module before importing our wrapper.
// Export both default and named Redis class to support both import styles.
vi.mock('iovalkey', () => {
  class MockRedis {
    get = mockGet;
    set = mockSet;
    del = mockDel;
    quit = mockQuit;
    on = mockOn;
  }
  return { default: MockRedis, Redis: MockRedis };
});

import { createValkeyClient, type ValkeyClient } from './valkey.js';

describe('createValkeyClient', () => {
  let client: ValkeyClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createValkeyClient('redis://localhost:6379');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns an object with get, set, del methods', () => {
    expect(typeof client.get).toBe('function');
    expect(typeof client.set).toBe('function');
    expect(typeof client.del).toBe('function');
  });

  describe('get', () => {
    it('calls underlying redis.get with the given key', async () => {
      await client.get('my-key');
      expect(mockGet).toHaveBeenCalledWith('my-key');
    });

    it('returns null when the key does not exist', async () => {
      mockGet.mockResolvedValueOnce(null);
      const result = await client.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns the stored string value when the key exists', async () => {
      mockGet.mockResolvedValueOnce('cached-value');
      const result = await client.get('existing-key');
      expect(result).toBe('cached-value');
    });
  });

  describe('set', () => {
    it('calls redis.set with key, value, EX, and TTL when ttlSeconds is provided', async () => {
      await client.set('my-key', 'my-value', 300);
      expect(mockSet).toHaveBeenCalledWith('my-key', 'my-value', 'EX', 300);
    });

    it('calls redis.set without EX args when no TTL is provided', async () => {
      await client.set('my-key', 'my-value');
      expect(mockSet).toHaveBeenCalledWith('my-key', 'my-value');
    });

    it('returns OK on success', async () => {
      mockSet.mockResolvedValueOnce('OK');
      const result = await client.set('key', 'value', 60);
      expect(result).toBe('OK');
    });
  });

  describe('del', () => {
    it('calls underlying redis.del with the given key', async () => {
      await client.del('my-key');
      expect(mockDel).toHaveBeenCalledWith('my-key');
    });

    it('returns 1 when one key was deleted', async () => {
      mockDel.mockResolvedValueOnce(1);
      const result = await client.del('existing-key');
      expect(result).toBe(1);
    });

    it('returns 0 when the key did not exist', async () => {
      mockDel.mockResolvedValueOnce(0);
      const result = await client.del('missing-key');
      expect(result).toBe(0);
    });
  });
});
