import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { media } from './media.js';
import { citext } from './users.js';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: citext('slug').unique().notNull(),
    name: text('name').notNull(),
    summary: text('summary'),
    description: text('description'),
    repoUrl: text('repo_url'),
    liveUrl: text('live_url'),
    featuredOrder: integer('featured_order'),
    startedAt: date('started_at'),
    endedAt: date('ended_at'),
    heroMediaId: uuid('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('projects_featured_order_idx').on(table.featuredOrder),
    // Composite index for public portfolio sort: featured_order ASC NULLS LAST, started_at DESC
    index('projects_portfolio_sort_idx').on(table.featuredOrder, table.startedAt),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
