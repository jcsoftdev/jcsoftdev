import { boolean, customType, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * citext — case-insensitive text extension for Postgres.
 *
 * Requires: CREATE EXTENSION IF NOT EXISTS citext; (initial migration).
 *
 * Used for slug and email columns so that uniqueness constraints are
 * case-insensitive without requiring application-level normalization.
 *
 * dataType: 'custom' is expected by Drizzle for customType columns.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').unique().notNull(),
  name: citext('name'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
