import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { media } from './media.js';
import { citext, users } from './users.js';

/**
 * post_status — Postgres native enum.
 * Enforces state at the DB level; no invalid states can be inserted.
 */
export const postStatus = pgEnum('post_status', ['draft', 'published', 'archived']);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: citext('slug').unique().notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    heroMediaId: uuid('hero_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // idx(status, published_at desc) — for public blog query filtering by status + ordering
    index('posts_status_published_at_idx').on(table.status, table.publishedAt),
    // idx(user_id) — for admin listing posts by author
    index('posts_user_id_idx').on(table.userId),
  ]
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostStatus = (typeof postStatus.enumValues)[number];
