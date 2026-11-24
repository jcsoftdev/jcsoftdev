import type { AppContext } from './context';
import { AppError } from './errors';
import { ROOM_LIFETIME_DAYS } from './limits';
import type { StoreOperations } from './ports';
import type { RoomRecord } from './records';
import { hashSecret, newRoomId, newToken, secretsMatch } from './security';
import { parseRoomName } from './validation';

const DAY_MILLISECONDS = 86_400_000;

export interface CreatedRoom {
  readonly roomId: string;
  readonly adminSecret: string;
}

export interface PublicRoom {
  readonly id: string;
  readonly name: string;
  readonly status: RoomRecord['status'];
  readonly participants: readonly { readonly id: string; readonly name: string }[];
}

export function requireRoom(room: RoomRecord | null): RoomRecord {
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  return room;
}

export function requireAdmin(room: RoomRecord, adminSecret: string | null): void {
  if (!adminSecret || !secretsMatch(adminSecret, room.adminSecretHash)) {
    throw new AppError('UNAUTHORIZED');
  }
}

export async function lockAdminRoom(
  operations: StoreOperations,
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<RoomRecord> {
  const room = requireRoom(await operations.lockRoom(roomId, context.now()));
  requireAdmin(room, adminSecret);
  return room;
}

export async function createRoom(context: AppContext, rawName: unknown): Promise<CreatedRoom> {
  const name = parseRoomName(rawName);
  const roomId = newRoomId();
  const adminSecret = newToken();
  const createdAt = context.now();
  await context.store.insertRoom({
    id: roomId,
    name,
    adminSecretHash: hashSecret(adminSecret),
    createdAt,
    expiresAt: new Date(createdAt.getTime() + ROOM_LIFETIME_DAYS * DAY_MILLISECONDS),
  });
  return { roomId, adminSecret };
}

export async function getPublicRoom(context: AppContext, roomId: string): Promise<PublicRoom> {
  const room = requireRoom(await context.store.findRoom(roomId, context.now()));
  const people = await context.store.listParticipants(roomId);
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    participants: people.map(({ id, name }) => ({ id, name })),
  };
}

export async function deleteRoom(
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<void> {
  await context.store.transaction(async (operations) => {
    await lockAdminRoom(operations, context, roomId, adminSecret);
    await operations.deleteRoom(roomId);
  });
}

export function purgeExpiredRooms(context: AppContext): Promise<number> {
  return context.store.purgeExpired(context.now());
}
