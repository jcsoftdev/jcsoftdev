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
});
