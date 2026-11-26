import { and, eq, gt, lte } from 'drizzle-orm';
import type { Store, StoreOperations } from '../application/ports';
import type {
  DeviceSession,
  ExclusionRecord,
  NewParticipant,
  NewRoom,
  ParticipantRecord,
  RoomRecord,
} from '../application/records';
import type { Db } from './database';
import { devices, exclusions, participants, rooms } from './schema';

function operationsOn(db: Db): StoreOperations {
  const activeRoom = (roomId: string, now: Date) =>
    and(eq(rooms.id, roomId), gt(rooms.expiresAt, now));

  const sealAssignments = async (
    roomId: string,
    sealedByParticipant: ReadonlyMap<string, string>
  ): Promise<void> => {
    for (const [participantId, sealed] of sealedByParticipant) {
      await db
        .update(participants)
        .set({ assignmentSealed: sealed })
        .where(and(eq(participants.id, participantId), eq(participants.roomId, roomId)));
    }
  };

  return {
    async insertRoom(room: NewRoom) {
      await db.insert(rooms).values(room);
    },

    async findRoom(roomId, now): Promise<RoomRecord | null> {
      const [row] = await db.select().from(rooms).where(activeRoom(roomId, now));
      return row ?? null;
    },

    async lockRoom(roomId, now): Promise<RoomRecord | null> {
      const [row] = await db.select().from(rooms).where(activeRoom(roomId, now)).for('update');
      return row ?? null;
    },

    async deleteRoom(roomId) {
      await db.delete(rooms).where(eq(rooms.id, roomId));
    },

    async purgeExpired(now) {
      const removed = await db
        .delete(rooms)
        .where(lte(rooms.expiresAt, now))
        .returning({ id: rooms.id });
      return removed.length;
    },

    async listParticipants(roomId): Promise<ParticipantRecord[]> {
      return db
        .select()
        .from(participants)
        .where(eq(participants.roomId, roomId))
        .orderBy(participants.createdAt, participants.name);
    },

    async insertParticipant(participant: NewParticipant) {
      const [created] = await db
        .insert(participants)
        .values(participant)
        .returning({ id: participants.id });
      if (!created) throw new Error('Participant insert returned no row');
      return created.id;
    },

    async deleteParticipant(roomId, participantId) {
      const removed = await db
        .delete(participants)
        .where(and(eq(participants.roomId, roomId), eq(participants.id, participantId)))
        .returning({ id: participants.id });
      return removed.length > 0;
    },

    async lockParticipant(roomId, participantId, now): Promise<ParticipantRecord | null> {
      const [participant] = await db
        .select()
        .from(participants)
        .where(and(eq(participants.id, participantId), eq(participants.roomId, roomId)))
        .for('update');
      if (!participant) return null;
      const [room] = await db.select({ id: rooms.id }).from(rooms).where(activeRoom(roomId, now));
      return room ? participant : null;
    },

    async recordAttempts(participantId, failedAttempts, lockedUntil) {
      await db
        .update(participants)
        .set({ failedAttempts, lockedUntil })
        .where(eq(participants.id, participantId));
    },

    async insertDevice(tokenHash, participantId) {
      await db.insert(devices).values({ tokenHash, participantId });
    },

    async findDeviceSession(roomId, tokenHash, now): Promise<DeviceSession | null> {
      const [row] = await db
        .select({ participant: participants, room: rooms })
        .from(devices)
        .innerJoin(participants, eq(participants.id, devices.participantId))
        .innerJoin(rooms, eq(rooms.id, participants.roomId))
        .where(
          and(
            eq(devices.tokenHash, tokenHash),
            eq(participants.roomId, roomId),
            gt(rooms.expiresAt, now)
          )
        );
      return row ?? null;
    },

    async listExclusions(roomId): Promise<ExclusionRecord[]> {
      return db
        .select({ giverId: exclusions.giverId, excludedId: exclusions.excludedId })
        .from(exclusions)
        .innerJoin(participants, eq(participants.id, exclusions.giverId))
        .where(eq(participants.roomId, roomId));
    },

    async replaceExclusions(giverId, excludedIds) {
      await db.delete(exclusions).where(eq(exclusions.giverId, giverId));
      if (excludedIds.length === 0) return;
      await db
        .insert(exclusions)
        .values(excludedIds.map((excludedId) => ({ giverId, excludedId })));
    },

    sealAssignments,

    async saveDraw(roomId, sealedByParticipant) {
      await sealAssignments(roomId, sealedByParticipant);
      await db.update(rooms).set({ status: 'drawn' }).where(eq(rooms.id, roomId));
    },

    async setRoomStatus(roomId, status) {
      await db.update(rooms).set({ status }).where(eq(rooms.id, roomId));
    },
  };
}

export function createDrizzleStore(db: Db): Store {
  return {
    ...operationsOn(db),
    transaction: (work) => db.transaction((tx) => work(operationsOn(tx as unknown as Db))),
  };
}
