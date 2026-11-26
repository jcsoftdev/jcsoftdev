import { beforeEach, describe, expect, it } from 'vitest';
import { getAdminView, removeParticipant, runDraw, setExclusions } from '../application/admin';
import { AppError, type ErrorCode } from '../application/errors';
import { getMe, joinRoom, recoverAccess } from '../application/participants';
import { createRoom, deleteRoom, getPublicRoom, purgeExpiredRooms } from '../application/rooms';
import { createTestContext, type TestContext } from './test-database';

const NAMES = ['Ana', 'Beto', 'Carla', 'Diego'];
const MINUTE = 60_000;
const DAY = 86_400_000;

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext();
});

async function expectCode(work: Promise<unknown>, code: ErrorCode) {
  const error = await work.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

async function roomWith(names: readonly string[]) {
  const room = await createRoom(context, 'Navidad');
  const people = [];
  for (const name of names) people.push(await joinRoom(context, room.roomId, name));
  return { ...room, people };
}

describe('drawing', () => {
  it('gives each person someone else, and each person is chosen once', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);

    const received: string[] = [];
    for (const person of people) {
      const me = await getMe(context, roomId, person.token);
      expect(me.receiverName).not.toBeNull();
      expect(me.receiverName).not.toBe(person.name);
      received.push(me.receiverName as string);
    }
    expect(new Set(received)).toEqual(new Set(NAMES));
  });

  it('never gives someone a person the admin excluded', async () => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const { roomId, adminSecret, people } = await roomWith(NAMES);
      const [ana, beto, carla] = people;
      await setExclusions(context, roomId, adminSecret, ana?.participantId, [
        beto?.participantId,
        carla?.participantId,
      ]);
      await runDraw(context, roomId, adminSecret);
      expect((await getMe(context, roomId, ana?.token ?? null)).receiverName).toBe('Diego');
    }
  });

  it('refuses an impossible draw, names who blocks it and keeps the room open', async () => {
    const { roomId, adminSecret, people } = await roomWith(['Ana', 'Beto', 'Carla']);
    const [ana, beto, carla] = people;
    await setExclusions(context, roomId, adminSecret, beto?.participantId, [carla?.participantId]);
    await setExclusions(context, roomId, adminSecret, carla?.participantId, [beto?.participantId]);

    const error = await expectCode(runDraw(context, roomId, adminSecret), 'DRAW_IMPOSSIBLE');
    expect([...(error.details.blocked as string[])].sort()).toEqual(['Beto', 'Carla']);
    expect((await getPublicRoom(context, roomId)).status).toBe('open');
    expect((await getMe(context, roomId, ana?.token ?? null)).receiverName).toBeNull();
  });

  it('needs at least three people', async () => {
    const { roomId, adminSecret } = await roomWith(['Ana', 'Beto']);
    await expectCode(runDraw(context, roomId, adminSecret), 'NOT_ENOUGH_PEOPLE');
  });

  it('closes registration and exclusions once drawn', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);
    await expectCode(joinRoom(context, roomId, 'Elena'), 'ROOM_CLOSED');
    await expectCode(
      setExclusions(context, roomId, adminSecret, people[0]?.participantId, []),
      'ALREADY_DRAWN'
    );
    await expectCode(runDraw(context, roomId, adminSecret), 'ALREADY_DRAWN');
  });
});

describe('who can see what', () => {
  it('shows the admin neither assignments nor codes', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);
    const view = JSON.stringify(await getAdminView(context, roomId, adminSecret));
    for (const person of people) expect(view).not.toContain(person.code);
    expect(view).not.toMatch(/receiver|assignment/i);
  });

  it('tells the admin each result is sound without revealing any pair', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    const before = await getAdminView(context, roomId, adminSecret);
    expect(before.soundCount).toBeNull();
    expect(before.participants.every((person) => person.check === null)).toBe(true);

    await runDraw(context, roomId, adminSecret);
    const after = await getAdminView(context, roomId, adminSecret);
    expect(after.soundCount).toBe(NAMES.length);
    for (const person of after.participants) {
      expect(person.check).toEqual({ gives: true, receives: true });
    }
    const serialized = JSON.stringify(after);
    for (const person of people) {
      const me = await getMe(context, roomId, person.token);
      const pair = `"name":"${person.name}"`;
      expect(serialized).toContain(pair);
      expect(serialized).not.toContain(`${person.name}${me.receiverName}`);
    }
  });

  it('flags a person whose result cannot be read', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);
    const ana = people[0]?.participantId ?? '';
    const stored = await context.store.listParticipants(roomId);
    const sealed = new Map(stored.map((person) => [person.id, person.assignmentSealed ?? '']));
    sealed.set(ana, 'v1.broken.value.here');
    await context.store.saveDraw(roomId, sealed);

    const view = await getAdminView(context, roomId, adminSecret);
    expect(view.participants.find((person) => person.id === ana)?.check?.gives).toBe(false);
    expect(view.participants.filter((person) => !person.check?.receives)).toHaveLength(1);
    expect(view.soundCount).toBe(NAMES.length - 2);
  });

  it('rejects a wrong admin secret on every admin action', async () => {
    const { roomId, people } = await roomWith(NAMES);
    const wrong = 'not-the-secret';
    const target = people[0]?.participantId;
    await expectCode(getAdminView(context, roomId, wrong), 'UNAUTHORIZED');
    await expectCode(getAdminView(context, roomId, null), 'UNAUTHORIZED');
    await expectCode(setExclusions(context, roomId, wrong, target, []), 'UNAUTHORIZED');
    await expectCode(removeParticipant(context, roomId, wrong, target), 'UNAUTHORIZED');
    await expectCode(runDraw(context, roomId, wrong), 'UNAUTHORIZED');
    await expectCode(deleteRoom(context, roomId, wrong), 'UNAUTHORIZED');
  });

  it('does not let a device of one room read another room', async () => {
    const first = await roomWith(NAMES);
    const second = await roomWith(NAMES);
    await expectCode(getMe(context, second.roomId, first.people[0]?.token ?? null), 'UNAUTHORIZED');
    await expectCode(getMe(context, first.roomId, null), 'UNAUTHORIZED');
  });

  it('keeps assignments sealed in storage', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);
    const stored = await context.store.listParticipants(roomId);
    for (const person of stored) {
      expect(person.assignmentSealed).not.toBeNull();
      for (const name of NAMES) expect(person.assignmentSealed).not.toContain(name);
    }
    expect(people).toHaveLength(NAMES.length);
  });
});

describe('joining', () => {
  it('treats names as the same regardless of case and spacing', async () => {
    const { roomId } = await roomWith(['Ana']);
    await expectCode(joinRoom(context, roomId, '  ana '), 'NAME_TAKEN');
    await expectCode(joinRoom(context, roomId, '   '), 'INVALID_INPUT');
  });

  it('gives each person a different four digit code', async () => {
    const { people } = await roomWith(NAMES);
    const codes = people.map((person) => person.code);
    expect(new Set(codes).size).toBe(NAMES.length);
    for (const code of codes) expect(code).toMatch(/^\d{4}$/);
  });
});

describe('recovering on another device', () => {
  it('shows the same result with the code', async () => {
    const { roomId, adminSecret, people } = await roomWith(NAMES);
    await runDraw(context, roomId, adminSecret);
    const ana = people[0];
    const original = await getMe(context, roomId, ana?.token ?? null);

    const recovered = await recoverAccess(context, roomId, ana?.participantId, ana?.code);
    const again = await getMe(context, roomId, recovered.token);
    expect(again.receiverName).toBe(original.receiverName);
    expect(again.code).toBe(ana?.code);
  });

  it('locks after five wrong codes, even for the right code, until the lock ends', async () => {
    const { roomId, people } = await roomWith(NAMES);
    const ana = people[0];
    const wrong = ana?.code === '0000' ? '1111' : '0000';

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const error = await expectCode(
        recoverAccess(context, roomId, ana?.participantId, wrong),
        'WRONG_CODE'
      );
      expect(error.details.attemptsLeft).toBe(5 - attempt);
    }
    await expectCode(recoverAccess(context, roomId, ana?.participantId, wrong), 'LOCKED');
    await expectCode(recoverAccess(context, roomId, ana?.participantId, ana?.code), 'LOCKED');

    context.clock.current = new Date(context.clock.current.getTime() + 16 * MINUTE);
    const recovered = await recoverAccess(context, roomId, ana?.participantId, ana?.code);
    expect(recovered.token).toBeTruthy();
  });

  it('does not lock other people when one person is guessed against', async () => {
    const { roomId, people } = await roomWith(NAMES);
    const [ana, beto] = people;
    const wrong = ana?.code === '0000' ? '1111' : '0000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recoverAccess(context, roomId, ana?.participantId, wrong).catch(() => undefined);
    }
    await expect(
      recoverAccess(context, roomId, beto?.participantId, beto?.code)
    ).resolves.toBeDefined();
  });
});

describe('room lifetime', () => {
  it('behaves like a missing room after thirty days and is purged', async () => {
    const { roomId } = await roomWith(NAMES);
    context.clock.current = new Date(context.clock.current.getTime() + 31 * DAY);
    await expectCode(getPublicRoom(context, roomId), 'ROOM_NOT_FOUND');
    await expectCode(joinRoom(context, roomId, 'Elena'), 'ROOM_NOT_FOUND');
    expect(await purgeExpiredRooms(context)).toBe(1);
    expect(await context.store.listParticipants(roomId)).toEqual([]);
  });

  it('removes everything when the admin deletes the room', async () => {
    const { roomId, adminSecret } = await roomWith(NAMES);
    await deleteRoom(context, roomId, adminSecret);
    await expectCode(getPublicRoom(context, roomId), 'ROOM_NOT_FOUND');
    expect(await context.store.listParticipants(roomId)).toEqual([]);
  });
});
