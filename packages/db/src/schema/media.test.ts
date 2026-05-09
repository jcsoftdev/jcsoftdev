import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;
type ColRecord = Record<string, { notNull?: boolean; isUnique?: boolean }>;

describe('media schema', () => {
  it('exports media table', async () => {
    const { media } = await import('./media.js');
    expect(media).toBeDefined();
  });

  it('media table has expected columns', async () => {
    const { media } = await import('./media.js');
    const columns = Object.keys(media);
    expect(columns).toContain('id');
    expect(columns).toContain('objectKey');
    expect(columns).toContain('bucket');
    expect(columns).toContain('mimeType');
    expect(columns).toContain('sizeBytes');
    expect(columns).toContain('uploadedBy');
    expect(columns).toContain('createdAt');
  });

  it('uploadedBy column references users(id) via table-level FK', async () => {
    const { media } = await import('./media.js');
    // In Drizzle, FKs are tracked at the table level via getTableConfig
    const tableConfig = getTableConfig(media);
    const fks = tableConfig.foreignKeys;
    expect(fks.length).toBeGreaterThan(0);
    const uploadedByFk = fks.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'uploaded_by')
    );
    expect(uploadedByFk).toBeDefined();
    // Verify it points to the users table
    const ref = uploadedByFk?.reference();
    expect(ref?.foreignColumns[0]?.name).toBe('id');
  });

  it('uploadedBy column is NOT NULL', async () => {
    const { media } = await import('./media.js');
    const uploadedByCol = (media as unknown as ColRecord).uploadedBy;
    expect(uploadedByCol?.notNull).toBe(true);
  });

  it('objectKey column is unique', async () => {
    const { media } = await import('./media.js');
    const objectKeyCol = (media as unknown as AnyRecord).objectKey as {
      isUnique?: boolean;
    };
    expect(objectKeyCol.isUnique).toBe(true);
  });

  it('barrel exports media table', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).media).toBeDefined();
  });
});
