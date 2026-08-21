import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;
type ColRecord = Record<string, { notNull?: boolean }>;

describe('accounts schema', () => {
  it('exports accounts table', async () => {
    const { accounts } = await import('./accounts.js');
    expect(accounts).toBeDefined();
  });

  it('accounts table has expected columns', async () => {
    const { accounts } = await import('./accounts.js');
    const columns = Object.keys(accounts);
    expect(columns).toContain('id');
    expect(columns).toContain('accountId');
    expect(columns).toContain('providerId');
    expect(columns).toContain('userId');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('userId FK references users(id) with ON DELETE CASCADE and is NOT NULL', async () => {
    const { accounts } = await import('./accounts.js');
    const tableConfig = getTableConfig(accounts);
    const userFk = tableConfig.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'user_id')
    );
    expect(userFk?.onDelete).toBe('cascade');
    const userIdCol = (accounts as unknown as ColRecord).userId;
    expect(userIdCol?.notNull).toBe(true);
  });

  // better-auth looks up accounts by user_id on every session lookup — this FK
  // must be indexed or that lookup falls back to a sequential scan.
  it('accounts table has an index on user_id', async () => {
    const { accounts } = await import('./accounts.js');
    const tableConfig = getTableConfig(accounts);
    const userIdIdx = tableConfig.indexes.find((idx) =>
      idx.config.columns.some((c) => 'name' in c && c.name === 'user_id')
    );
    expect(userIdIdx).toBeDefined();
    expect(userIdIdx?.config.name).toBe('accounts_user_id_idx');
  });

  it('barrel exports accounts table', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).accounts).toBeDefined();
  });
});
