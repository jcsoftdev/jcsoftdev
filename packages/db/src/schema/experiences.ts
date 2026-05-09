import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const experiences = pgTable(
  'experiences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    company: text('company').notNull(),
    role: text('role').notNull(),
    summary: text('summary'),
    startedAt: date('started_at').notNull(),
    endedAt: date('ended_at'),
    location: text('location'),
    // displayOrder determines sort order on the CV; must be unique for idempotent seeding
    displayOrder: integer('display_order').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('experiences_started_at_idx').on(table.startedAt)]
);

export type Experience = typeof experiences.$inferSelect;
export type NewExperience = typeof experiences.$inferInsert;
