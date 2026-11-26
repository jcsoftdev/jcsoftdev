import { type Assignments, insertSegment, removeFromChain } from '../domain/chain';
import { drawAssignments, type Exclusions } from '../domain/draw';
import type { AppContext } from './context';
import { AppError } from './errors';
import { MIN_PARTICIPANTS_FOR_DRAW } from './limits';
import type { StoreOperations } from './ports';
import type { ParticipantRecord, RoomRecord } from './records';
import { lockAdminRoom, requireAdmin, requireRoom } from './rooms';
import { parseId, parseIdList } from './validation';

export interface DrawCheck {
  readonly gives: boolean;
  readonly receives: boolean | null;
}

export interface AdminParticipant {
  readonly id: string;
  readonly name: string;
  readonly excludedIds: readonly string[];
  readonly pending: boolean;
  readonly check: DrawCheck | null;
}

export interface AdminView {
  readonly id: string;
  readonly name: string;
  readonly status: RoomRecord['status'];
  readonly expiresAt: string;
  readonly minimumToDraw: number;
  readonly participants: readonly AdminParticipant[];
  readonly soundCount: number | null;
  readonly drawnCount: number;
}

export interface ChangeOutcome {
  readonly existingResultChanged: boolean;
}

const isPending = (person: ParticipantRecord) => person.assignmentSealed === null;

function openSafely(
  context: AppContext,
  sealed: string | null,
  participantId: string
): string | null {
  if (!sealed) return null;
  try {
    return context.sealer.open(sealed, participantId);
  } catch {
    return null;
  }
}

function drawChecks(
  context: AppContext,
  people: readonly ParticipantRecord[]
): Map<string, DrawCheck> {
  const assigned = people.filter((person) => !isPending(person));
  const names = new Set(people.map((person) => person.name));
  const targets = assigned.map((person) => ({
    person,
    target: openSafely(context, person.assignmentSealed, person.id),
  }));
  const timesChosen = new Map<string, number>();
  for (const { target } of targets) {
    if (target) timesChosen.set(target, (timesChosen.get(target) ?? 0) + 1);
  }
  const gives = new Map(
    targets.map(({ person, target }) => [
      person.id,
      target !== null && target !== person.name && names.has(target),
    ])
  );
  const everyResultReadable = [...gives.values()].every(Boolean);
  return new Map(
    assigned.map((person) => [
      person.id,
      {
        gives: gives.get(person.id) ?? false,
        receives: everyResultReadable ? timesChosen.get(person.name) === 1 : null,
      },
    ])
  );
}

function openAssignments(
  context: AppContext,
  people: readonly ParticipantRecord[]
): Assignments | null {
  const idByName = new Map(people.map((person) => [person.name, person.id]));
  const assignments = new Map<string, string>();
  for (const person of people.filter((each) => !isPending(each))) {
    const target = openSafely(context, person.assignmentSealed, person.id);
    const targetId = target === null ? undefined : idByName.get(target);
    if (targetId === undefined) return null;
    assignments.set(person.id, targetId);
  }
  return assignments;
}

async function exclusionsOf(operations: StoreOperations, roomId: string): Promise<Exclusions> {
  const exclusions = new Map<string, Set<string>>();
  for (const { giverId, excludedId } of await operations.listExclusions(roomId)) {
    exclusions.set(giverId, (exclusions.get(giverId) ?? new Set()).add(excludedId));
  }
  return exclusions;
}

function sealAll(
  context: AppContext,
  people: readonly ParticipantRecord[],
  assignments: Assignments
): Map<string, string> {
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  const sealed = new Map<string, string>();
  for (const [giverId, receiverId] of assignments) {
    sealed.set(giverId, context.sealer.seal(nameOf.get(receiverId) ?? '', giverId));
  }
  return sealed;
}

function blockedError(people: readonly ParticipantRecord[], ids: readonly string[]): AppError {
  const nameOf = new Map(people.map((person) => [person.id, person.name]));
  return new AppError('DRAW_IMPOSSIBLE', { blocked: ids.map((id) => nameOf.get(id) ?? id) });
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
  const drawn = room.status !== 'open';
  const checks = drawn ? drawChecks(context, people) : null;
  const participants = people.map((person) => ({
    id: person.id,
    name: person.name,
    excludedIds: exclusions
      .filter((exclusion) => exclusion.giverId === person.id)
      .map((exclusion) => exclusion.excludedId),
    pending: drawn && isPending(person),
    check: checks?.get(person.id) ?? null,
  }));
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    expiresAt: room.expiresAt.toISOString(),
    minimumToDraw: MIN_PARTICIPANTS_FOR_DRAW,
    participants,
    soundCount: checks
      ? participants.filter((person) => person.check?.gives && person.check.receives !== false)
          .length
      : null,
    drawnCount: checks?.size ?? 0,
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
    const people = await operations.listParticipants(roomId);
    const giver = people.find((person) => person.id === giverId);
    if (!giver) throw new AppError('NOT_FOUND');
    const pendingIds = new Set(people.filter(isPending).map((person) => person.id));
    const current = new Set(
      (await operations.listExclusions(roomId))
        .filter((exclusion) => exclusion.giverId === giverId)
        .map((exclusion) => exclusion.excludedId)
    );
    const touched = [
      ...excludedIds.filter((id) => !current.has(id)),
      ...[...current].filter((id) => !excludedIds.includes(id)),
    ];
    const editable =
      room.status === 'open' ||
      (room.status === 'reopened' &&
        (isPending(giver) || touched.every((id) => pendingIds.has(id))));
    if (!editable) throw new AppError('ALREADY_DRAWN');
    const knownIds = new Set(people.map((person) => person.id));
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
): Promise<ChangeOutcome> {
  const participantId = parseId(rawParticipantId);
  return context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    const people = await operations.listParticipants(roomId);
    const leaving = people.find((person) => person.id === participantId);
    if (!leaving) throw new AppError('NOT_FOUND');

    if (room.status === 'open' || isPending(leaving)) {
      await operations.deleteParticipant(roomId, participantId);
      return { existingResultChanged: false };
    }

    const drawnCount = people.filter((person) => !isPending(person)).length;
    if (drawnCount - 1 < MIN_PARTICIPANTS_FOR_DRAW) {
      throw new AppError('NOT_ENOUGH_PEOPLE', { minimum: MIN_PARTICIPANTS_FOR_DRAW });
    }
    const assignments = openAssignments(context, people);
    if (!assignments) throw new AppError('CANNOT_REMOVE');
    const result = removeFromChain(
      assignments,
      participantId,
      await exclusionsOf(operations, roomId),
      context.random
    );
    if (!result.ok) throw new AppError('CANNOT_REMOVE');
    await operations.sealAssignments(roomId, sealAll(context, people, result.changes));
    await operations.deleteParticipant(roomId, participantId);
    return { existingResultChanged: true };
  });
}

export async function reopenRegistration(
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<void> {
  await context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    if (room.status === 'open') throw new AppError('NOT_DRAWN');
    if (room.status === 'drawn') await operations.setRoomStatus(roomId, 'reopened');
  });
}

async function drawEveryone(
  context: AppContext,
  operations: StoreOperations,
  roomId: string,
  people: readonly ParticipantRecord[]
): Promise<ChangeOutcome> {
  if (people.length < MIN_PARTICIPANTS_FOR_DRAW) {
    throw new AppError('NOT_ENOUGH_PEOPLE', { minimum: MIN_PARTICIPANTS_FOR_DRAW });
  }
  const result = drawAssignments(
    people.map((person) => person.id),
    await exclusionsOf(operations, roomId),
    context.random
  );
  if (!result.ok) throw blockedError(people, result.blocked);
  await operations.saveDraw(roomId, sealAll(context, people, result.assignments));
  return { existingResultChanged: false };
}

async function drawNewcomers(
  context: AppContext,
  operations: StoreOperations,
  roomId: string,
  people: readonly ParticipantRecord[]
): Promise<ChangeOutcome> {
  const newcomers = people.filter(isPending);
  if (newcomers.length === 0) {
    await operations.setRoomStatus(roomId, 'drawn');
    return { existingResultChanged: false };
  }
  const assignments = openAssignments(context, people);
  const newcomerIds = newcomers.map((person) => person.id);
  const result = assignments
    ? insertSegment(
        assignments,
        newcomerIds,
        await exclusionsOf(operations, roomId),
        context.random
      )
    : { ok: false as const };
  if (!result.ok) throw blockedError(people, newcomerIds);
  await operations.saveDraw(roomId, sealAll(context, people, result.changes));
  return { existingResultChanged: true };
}

export async function runDraw(
  context: AppContext,
  roomId: string,
  adminSecret: string | null
): Promise<ChangeOutcome> {
  return context.store.transaction(async (operations) => {
    const room = await lockAdminRoom(operations, context, roomId, adminSecret);
    const people = await operations.listParticipants(roomId);
    switch (room.status) {
      case 'open':
        return drawEveryone(context, operations, roomId, people);
      case 'reopened':
        return drawNewcomers(context, operations, roomId, people);
      case 'drawn':
        throw new AppError('ALREADY_DRAWN');
    }
  });
}
