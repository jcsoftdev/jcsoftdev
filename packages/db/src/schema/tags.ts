import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { posts } from './posts.js';
import { citext } from './users.js';

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: citext('slug').unique().notNull(),
  name: text('name').notNull(),
});

export const postTags = pgTable(
  'post_tags',
  {
    postId: uuid('post_id')
      .references(() => posts.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_tag_id_idx').on(table.tagId),
  ]
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PostTag = typeof postTags.$inferSelect;
export type NewPostTag = typeof postTags.$inferInsert;
