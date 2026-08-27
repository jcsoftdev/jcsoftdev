import { describe, expect, it } from 'vitest';

describe('@jcsoftdev/db', () => {
  it('exports createClient function', async () => {
    const { createClient } = await import('./client.js');
    expect(typeof createClient).toBe('function');
  });

  it('exports schema barrel', async () => {
    const { schema } = await import('./schema/index.js');
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');
  });

  it('sends no startup parameters that pgbouncer would reject', async () => {
    // Regression guard for a full production outage.
    //
    // This test used to assert the opposite — that connection.statement_timeout
    // was 15_000 — and so it locked the outage in place. postgres-js turns
    // `connection` entries into startup parameters, and pgbouncer in
    // transaction-pooling mode closes the socket on any it cannot track:
    //
    //   WARNING unsupported startup parameter: statement_timeout=15000
    //   LOG     closing because: unsupported startup parameter (age=0s)
    //
    // Every DB-backed route 500'd. statement_timeout is now set on the database
    // itself (migration 0004), which pooling cannot strip.
    const { createClient } = await import('./client.js');
    const db = createClient('postgres://user:pass@localhost:6432/db');
    const client = (
      db as unknown as {
        $client: { options: { connection?: Record<string, unknown>; prepare: boolean } };
      }
    ).$client;

    // pgbouncer tracks only these four by default; anything else kills the
    // handshake. postgres-js always sets client_encoding itself.
    const POOLER_SAFE = new Set([
      'client_encoding',
      'datestyle',
      'DateStyle',
      'timezone',
      'TimeZone',
      'standard_conforming_strings',
      'application_name',
    ]);

    for (const key of Object.keys(client.options.connection ?? {})) {
      const value = (client.options.connection ?? {})[key];
      if (value === undefined) continue;
      expect(
        POOLER_SAFE.has(key),
        `connection option "${key}" becomes a startup parameter and pgbouncer will refuse the connection`
      ).toBe(true);
    }

    expect(client.options.connection?.statement_timeout).toBeUndefined();
    // prepare:false is the other hard pgbouncer transaction-mode requirement.
    expect(client.options.prepare).toBe(false);
  });
});
