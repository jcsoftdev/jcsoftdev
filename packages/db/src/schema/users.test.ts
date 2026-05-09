import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;

describe('users schema', () => {
  it('exports users table', async () => {
    const { users } = await import('./users.js');
    expect(users).toBeDefined();
  });

  it('users table is a Drizzle PgTable', async () => {
    const { users } = await import('./users.js');
    // PgTable instances are objects (not null)
    expect(typeof users).toBe('object');
    expect(users).not.toBeNull();
  });

  it('users table has the expected columns', async () => {
    const { users } = await import('./users.js');
    const columns = Object.keys(users);
    expect(columns).toContain('id');
    expect(columns).toContain('email');
    expect(columns).toContain('name');
    expect(columns).toContain('emailVerified');
    expect(columns).toContain('createdAt');
  });

  it('email column uses citext data type', async () => {
    const { users } = await import('./users.js');
    // citext columns have dataType 'custom' in Drizzle
    const emailCol = (users as unknown as AnyRecord).email as {
      columnType?: string;
      dataType?: string;
    };
    expect(emailCol).toBeDefined();
    // Drizzle custom type columns expose dataType 'custom'
    expect(emailCol.dataType).toBe('custom');
  });

  it('barrel exports users table', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).users).toBeDefined();
  });
});
