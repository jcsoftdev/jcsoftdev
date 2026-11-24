import {
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { ROOM_STATUSES } from '../domain/room';

export const SCHEMA_NAME = 'sorteo_regalos';
export const MIGRATIONS_TABLE = 'migrations';

const sorteo = pgSchema(SCHEMA_NAME);

const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });

export const rooms = sorteo.table(
  'rooms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    adminSecretHash: text('admin_secret_hash').notNull(),
    status: text('status', { enum: ROOM_STATUSES }).notNull().default('open'),
    createdAt: timestampColumn('created_at').notNull().defaultNow(),
    expiresAt: timestampColumn('expires_at').notNull(),
  },
  (table) => [index('rooms_expires_at_idx').on(table.expiresAt)]
);

export const participants = sorteo.table(
  'participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    code: text('code').notNull(),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestampColumn('locked_until'),
    assignmentSealed: text('assignment_sealed'),
    createdAt: timestampColumn('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('participants_room_name_key').on(table.roomId, table.nameKey),
    unique('participants_room_code').on(table.roomId, table.code),
  ]
);

export const devices = sorteo.table('devices', {
  tokenHash: text('token_hash').primaryKey(),
  participantId: uuid('participant_id')
    .notNull()
    .references(() => participants.id, { onDelete: 'cascade' }),
  createdAt: timestampColumn('created_at').notNull().defaultNow(),
});

export const exclusions = sorteo.table(
  'exclusions',
  {
    giverId: uuid('giver_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    excludedId: uuid('excluded_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.giverId, table.excludedId] })]
);
