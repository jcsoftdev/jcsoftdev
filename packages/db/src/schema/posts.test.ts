import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;
type ColRecord = Record<string, { notNull?: boolean }>;

describe('posts schema', () => {
  it('exports posts table', async () => {
    const { posts } = await import('./posts.js');
    expect(posts).toBeDefined();
  });

  it('exports post_status enum', async () => {
    const { postStatus } = await import('./posts.js');
    expect(postStatus).toBeDefined();
  });

  it('post_status enum has correct values', async () => {
    const { postStatus } = await import('./posts.js');
    expect(postStatus.enumValues).toContain('draft');
    expect(postStatus.enumValues).toContain('published');
    expect(postStatus.enumValues).toContain('archived');
    expect(postStatus.enumValues).toHaveLength(3);
  });

  it('posts table has expected columns', async () => {
    const { posts } = await import('./posts.js');
    const columns = Object.keys(posts);
    expect(columns).toContain('id');
    expect(columns).toContain('slug');
    expect(columns).toContain('title');
    expect(columns).toContain('content');
    expect(columns).toContain('status');
    expect(columns).toContain('userId');
    expect(columns).toContain('heroMediaId');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('slug column uses citext data type', async () => {
    const { posts } = await import('./posts.js');
    const slugCol = (posts as unknown as AnyRecord).slug as {
      dataType?: string;
    };
    expect(slugCol.dataType).toBe('custom');
  });

  it('slug column is unique', async () => {
    const { posts } = await import('./posts.js');
    const slugCol = (posts as unknown as AnyRecord).slug as {
      isUnique?: boolean;
    };
    expect(slugCol.isUnique).toBe(true);
  });

  it('userId FK references users(id) and is NOT NULL', async () => {
    const { posts } = await import('./posts.js');
    const tableConfig = getTableConfig(posts);
    const userFk = tableConfig.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'user_id')
    );
    expect(userFk).toBeDefined();
    // user_id must NOT be null (required author)
    const userIdCol = (posts as unknown as ColRecord).userId;
    expect(userIdCol?.notNull).toBe(true);
  });

  it('heroMediaId FK references media(id) and is nullable', async () => {
    const { posts } = await import('./posts.js');
    const tableConfig = getTableConfig(posts);
    const mediaFk = tableConfig.foreignKeys.find((fk) =>
      fk.reference().columns.some((c) => c.name === 'hero_media_id')
    );
    expect(mediaFk).toBeDefined();
    // hero_media_id must be nullable (post may not have a hero image)
    const heroMediaIdCol = (posts as unknown as ColRecord).heroMediaId;
    expect(heroMediaIdCol?.notNull).toBeFalsy();
  });

  it('barrel exports posts table and postStatus enum', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).posts).toBeDefined();
    expect((barrel as unknown as AnyRecord).postStatus).toBeDefined();
  });
});
