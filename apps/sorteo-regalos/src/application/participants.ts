import { acceptsNewPeople } from '../domain/room';
import type { AppContext } from './context';
import { AppError } from './errors';
import { LOCK_MINUTES, MAX_FAILED_CODE_ATTEMPTS, MAX_PARTICIPANTS } from './limits';
import type { RoomRecord } from './records';
import { requireRoom } from './rooms';
import { hashSecret, newCode, newToken, textsMatch } from './security';
import { parseCode, parseId, parseParticipantName, toNameKey } from './validation';

const MINUTE_MILLISECONDS = 60_000;

export interface Joined {
  readonly participantId: string;
  readonly name: string;
  readonly code: string;
  readonly token: string;
}

export interface Recovered {
  readonly participantId: string;
  readonly token: string;
}

export interface Me {
  readonly participantId: string;
  readonly name: string;
  readonly code: string;
  readonly roomName: string;
  readonly status: RoomRecord['status'];
  readonly receiverName: string | null;
}

function freshCode(taken: ReadonlySet<string>): string {
  let code = newCode();
  while (taken.has(code)) code = newCode();
  return code;
}

export async function joinRoom(
  context: AppContext,
  roomId: string,
  rawName: unknown
): Promise<Joined> {
  const name = parseParticipantName(rawName);
  const nameKey = toNameKey(name);
  const token = newToken();

  const created = await context.store.transaction(async (operations) => {
    const room = requireRoom(await operations.lockRoom(roomId, context.now()));
    if (!acceptsNewPeople(room.status)) throw new AppError('ROOM_CLOSED');
    const existing = await operations.listParticipants(roomId);
    if (existing.length >= MAX_PARTICIPANTS) throw new AppError('ROOM_FULL');
    if (existing.some((person) => person.nameKey === nameKey)) throw new AppError('NAME_TAKEN');
    const code = freshCode(new Set(existing.map((person) => person.code)));
    const participantId = await operations.insertParticipant({ roomId, name, nameKey, code });
    await operations.insertDevice(hashSecret(token), participantId);
    return { participantId, code };
  });

  return { ...created, name, token };
}

type RecoveryOutcome =
  | { readonly kind: 'missing' }
  | { readonly kind: 'locked'; readonly until: Date }
  | { readonly kind: 'wrong'; readonly attemptsLeft: number }
  | { readonly kind: 'granted'; readonly token: string };

export async function recoverAccess(
  context: AppContext,
  roomId: string,
  rawParticipantId: unknown,
  rawCode: unknown
): Promise<Recovered> {
  const participantId = parseId(rawParticipantId);
  const code = parseCode(rawCode);

  const outcome = await context.store.transaction(async (operations): Promise<RecoveryOutcome> => {
    const now = context.now();
    const participant = await operations.lockParticipant(roomId, participantId, now);
    if (!participant) return { kind: 'missing' };
    if (participant.lockedUntil && participant.lockedUntil > now) {
      return { kind: 'locked', until: participant.lockedUntil };
    }
    if (textsMatch(participant.code, code)) {
      const token = newToken();
      await operations.recordAttempts(participant.id, 0, null);
      await operations.insertDevice(hashSecret(token), participant.id);
      return { kind: 'granted', token };
    }
    const failedAttempts = participant.failedAttempts + 1;
    if (failedAttempts >= MAX_FAILED_CODE_ATTEMPTS) {
      const until = new Date(now.getTime() + LOCK_MINUTES * MINUTE_MILLISECONDS);
      await operations.recordAttempts(participant.id, 0, until);
      return { kind: 'locked', until };
    }
    await operations.recordAttempts(participant.id, failedAttempts, null);
    return { kind: 'wrong', attemptsLeft: MAX_FAILED_CODE_ATTEMPTS - failedAttempts };
  });

  switch (outcome.kind) {
    case 'granted':
      return { participantId, token: outcome.token };
    case 'locked':
      throw new AppError('LOCKED', { until: outcome.until.toISOString() });
    case 'wrong':
      throw new AppError('WRONG_CODE', { attemptsLeft: outcome.attemptsLeft });
    case 'missing':
      throw new AppError('NOT_FOUND');
  }
}

export async function getMe(
  context: AppContext,
  roomId: string,
  token: string | null
): Promise<Me> {
  if (!token) throw new AppError('UNAUTHORIZED');
  const session = await context.store.findDeviceSession(roomId, hashSecret(token), context.now());
  if (!session) throw new AppError('UNAUTHORIZED');
  const { participant, room } = session;
  return {
    participantId: participant.id,
    name: participant.name,
    code: participant.code,
    roomName: room.name,
    status: room.status,
    receiverName: participant.assignmentSealed
      ? context.sealer.open(participant.assignmentSealed, participant.id)
      : null,
  };
}
