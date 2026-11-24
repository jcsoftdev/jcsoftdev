import { drawAssignments } from '../domain/draw';
import type { AppContext } from './context';
import { AppError } from './errors';
import { MIN_PARTICIPANTS_FOR_DRAW } from './limits';
import type { RoomRecord } from './records';
import { lockAdminRoom, requireAdmin, requireRoom } from './rooms';
import { parseId, parseIdList } from './validation';

export interface AdminParticipant {
  readonly id: string;
  readonly name: string;
  readonly excludedIds: readonly string[];
}

export interface AdminView {
  readonly id: string;
  readonly name: string;
  readonly status: RoomRecord['status'];
  readonly expiresAt: string;
  readonly minimumToDraw: number;
  readonly participants: readonly AdminParticipant[];
}

function requireOpen(room: RoomRecord): void {
  if (room.status !== 'open') throw new AppError('ALREADY_DRAWN');
}

export async function getAdminView(
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<AdminView> {
  const room = requireRoom(await context.store.findRoom(roomId, context.now()));
  requireAdmin(room, adminSecret);
  const [people, exclusions] = await Promise.all([
    context.store.listParticipants(roomId),
    context.store.listExclusions(roomId),
  ]);
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    expiresAt: room.expiresAt.toISOString(),
    minimumToDraw: MIN_PARTICIPANTS_FOR_DRAW,
    participants: people.map(({ id, name }) => ({
      id,
      name,
      excludedIds: exclusions
        .filter((exclusion) => exclusion.giverId === id)
        .map((exclusion) => exclusion.excludedId),
    })),
  };
}

export async function setExclusions(
  context: AppContext,
  roomId: string,
  adminSecret: string | null,
  rawGiverId: unknown,
  rawExcludedIds: unknown
): Promise<void> {
  const giverId = parseId(rawGiverId);
  const excludedIds = parseIdList(rawExcludedIds);

  await context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    requireOpen(room);
    const knownIds = new Set(
      (await operations.listParticipants(roomId)).map((person) => person.id)
    );
    if (!knownIds.has(giverId)) throw new AppError('NOT_FOUND');
    if (excludedIds.some((id) => id === giverId || !knownIds.has(id))) {
      throw new AppError('INVALID_INPUT');
    }
    await operations.replaceExclusions(giverId, excludedIds);
  });
}

export async function removeParticipant(
  context: AppContext,
  roomId: string,
  adminSecret: string | null,
  rawParticipantId: unknown
): Promise<void> {
  const participantId = parseId(rawParticipantId);
  await context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    requireOpen(room);
    if (!(await operations.deleteParticipant(roomId, participantId))) {
      throw new AppError('NOT_FOUND');
    }
  });
}

export async function runDraw(
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<void> {
  await context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    requireOpen(room);
    const people = await operations.listParticipants(roomId);
    if (people.length < MIN_PARTICIPANTS_FOR_DRAW) {
      throw new AppError('NOT_ENOUGH_PEOPLE', { minimum: MIN_PARTICIPANTS_FOR_DRAW });
    }

    const exclusions = new Map<string, Set<string>>();
    for (const { giverId, excludedId } of await operations.listExclusions(roomId)) {
      exclusions.set(giverId, (exclusions.get(giverId) ?? new Set()).add(excludedId));
    }

    const result = drawAssignments(
      people.map((person) => person.id),
      exclusions,
      context.random
    );
    const nameOf = new Map(people.map((person) => [person.id, person.name]));
    if (!result.ok) {
      throw new AppError('DRAW_IMPOSSIBLE', {
        blocked: result.blocked.map((id) => nameOf.get(id) ?? id),
      });
    }

    const sealed = new Map<string, string>();
    for (const [giverId, receiverId] of result.assignments) {
      sealed.set(giverId, context.sealer.seal(nameOf.get(receiverId) ?? '', giverId));
    }
    await operations.saveDraw(roomId, sealed);
  });
}
