import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;

describe('tags + post_tags schema', () => {
  it('exports tags table', async () => {
    const { tags } = await import('./tags.js');
    expect(tags).toBeDefined();
  });

  it('exports postTags table', async () => {
    const { postTags } = await import('./tags.js');
    expect(postTags).toBeDefined();
  });

  it('tags table has expected columns', async () => {
    const { tags } = await import('./tags.js');
    const columns = Object.keys(tags);
    expect(columns).toContain('id');
    expect(columns).toContain('slug');
    expect(columns).toContain('name');
  });

  it('tags.slug column uses citext data type (case-insensitive)', async () => {
    const { tags } = await import('./tags.js');
    const slugCol = (tags as unknown as AnyRecord).slug as {
      dataType?: string;
    };
    expect(slugCol.dataType).toBe('custom');
  });

  it('tags.slug is unique', async () => {
    const { tags } = await import('./tags.js');
    const slugCol = (tags as unknown as AnyRecord).slug as {
      isUnique?: boolean;
    };
    expect(slugCol.isUnique).toBe(true);
  });

  it('postTags has composite primary key (post_id, tag_id)', async () => {
    const { postTags } = await import('./tags.js');
    const tableConfig = getTableConfig(postTags);
    // Composite PK is expressed as a primaryKey() constraint in Drizzle
    expect(tableConfig.primaryKeys.length).toBeGreaterThan(0);
    const pkCols = tableConfig.primaryKeys[0]?.columns.map((c) => c.name);
    expect(pkCols).toContain('post_id');
    expect(pkCols).toContain('tag_id');
  });

  it('postTags has FK from post_id to posts(id)', async () => {
    const { postTags } = await import('./tags.js');
    const tableConfig = getTableConfig(postTags);
    const postFk = tableConfig.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'post_id')
    );
    expect(postFk).toBeDefined();
  });

  it('postTags has FK from tag_id to tags(id)', async () => {
    const { postTags } = await import('./tags.js');
    const tableConfig = getTableConfig(postTags);
    const tagFk = tableConfig.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'tag_id')
    );
    expect(tagFk).toBeDefined();
  });

  it('barrel exports tags and postTags', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).tags).toBeDefined();
    expect((barrel as unknown as AnyRecord).postTags).toBeDefined();
  });
});
