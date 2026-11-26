import type { Exclusions, RandomSource } from './draw';

export type Assignments = ReadonlyMap<string, string>;

export type ChainChange =
  | { readonly ok: true; readonly changes: ReadonlyMap<string, string> }
  | { readonly ok: false };

const ORDER_ATTEMPTS = 50;
const FAILED: ChainChange = { ok: false };

const canGive = (exclusions: Exclusions, giver: string, receiver: string) =>
  giver !== receiver && !exclusions.get(giver)?.has(receiver);

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith] as T, copy[index] as T];
  }
  return copy;
}

function rotated<T>(items: readonly T[], random: RandomSource): T[] {
  const start = Math.floor(random() * items.length);
  return [...items.slice(start), ...items.slice(0, start)];
}

function segmentFits(path: readonly string[], exclusions: Exclusions): boolean {
  return path.every((giver, index) => {
    const receiver = path[index + 1];
    return receiver === undefined || canGive(exclusions, giver, receiver);
  });
}

function linksOf(path: readonly string[]): Map<string, string> {
  const links = new Map<string, string>();
  path.forEach((giver, index) => {
    const receiver = path[index + 1];
    if (receiver !== undefined) links.set(giver, receiver);
  });
  return links;
}

export function insertSegment(
  assignments: Assignments,
  newcomerIds: readonly string[],
  exclusions: Exclusions,
  random: RandomSource
): ChainChange {
  if (newcomerIds.length === 0) return { ok: true, changes: new Map() };
  for (let attempt = 0; attempt < ORDER_ATTEMPTS; attempt += 1) {
    const order = shuffled(newcomerIds, random);
    for (const [giver, receiver] of rotated([...assignments], random)) {
      const path = [giver, ...order, receiver];
      if (segmentFits(path, exclusions)) return { ok: true, changes: linksOf(path) };
    }
  }
  return FAILED;
}

function rehomeGiver(
  rest: Assignments,
  giver: string,
  orphan: string,
  exclusions: Exclusions,
  random: RandomSource
): ChainChange {
  for (const [other, otherReceiver] of rotated([...rest], random)) {
    if (other === giver || otherReceiver === giver) continue;
    if (canGive(exclusions, giver, otherReceiver) && canGive(exclusions, other, orphan)) {
      return {
        ok: true,
        changes: new Map([
          [giver, otherReceiver],
          [other, orphan],
        ]),
      };
    }
  }
  return FAILED;
}

export function removeFromChain(
  assignments: Assignments,
  leavingId: string,
  exclusions: Exclusions,
  random: RandomSource
): ChainChange {
  const receiver = assignments.get(leavingId);
  const giver = [...assignments].find(([, target]) => target === leavingId)?.[0];
  if (receiver === undefined || giver === undefined) return FAILED;
  if (canGive(exclusions, giver, receiver)) {
    return { ok: true, changes: new Map([[giver, receiver]]) };
  }

  const rest = new Map(assignments);
  rest.delete(leavingId);
  if (giver === receiver) {
    rest.delete(giver);
    return insertSegment(rest, [giver], exclusions, random);
  }
  return rehomeGiver(rest, giver, receiver, exclusions, random);
}
