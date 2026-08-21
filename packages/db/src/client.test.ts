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

  it('sets a statement_timeout so a locked query cannot hang forever', async () => {
    const { createClient } = await import('./client.js');
    const db = createClient('postgres://user:pass@localhost:6432/db');
    const client = (
      db as unknown as { $client: { options: { connection: { statement_timeout?: number } } } }
    ).$client;
    expect(client.options.connection.statement_timeout).toBe(15_000);
  });
});
