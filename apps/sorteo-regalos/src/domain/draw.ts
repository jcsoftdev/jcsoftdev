export type Exclusions = ReadonlyMap<string, ReadonlySet<string>>;

export type DrawResult =
  | { readonly ok: true; readonly assignments: ReadonlyMap<string, string> }
  | { readonly ok: false; readonly blocked: readonly string[] };

export type RandomSource = () => number;

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const held = copy[index] as T;
    copy[index] = copy[swapWith] as T;
    copy[swapWith] = held;
  }
  return copy;
}

export function drawAssignments(
  participantIds: readonly string[],
  exclusions: Exclusions,
  random: RandomSource
): DrawResult {
  const giverOf = new Map<string, string>();
  const receivers = [...participantIds];

  const canGiveTo = (giver: string, receiver: string) =>
    giver !== receiver && !exclusions.get(giver)?.has(receiver);

  const tryAssign = (giver: string, seen: Set<string>): boolean => {
    for (const receiver of shuffled(receivers, random)) {
      if (!canGiveTo(giver, receiver) || seen.has(receiver)) continue;
      seen.add(receiver);
      const holder = giverOf.get(receiver);
      if (holder === undefined || tryAssign(holder, seen)) {
        giverOf.set(receiver, giver);
        return true;
      }
    }
    return false;
  };

  for (const giver of shuffled(participantIds, random)) {
    const seen = new Set<string>();
    if (tryAssign(giver, seen)) continue;
    const involved = new Set<string>([giver]);
    for (const receiver of seen) {
      const holder = giverOf.get(receiver);
      if (holder !== undefined) involved.add(holder);
    }
    return { ok: false, blocked: [...involved] };
  }

  const assignments = new Map<string, string>();
  for (const [receiver, giver] of giverOf) assignments.set(giver, receiver);
  return { ok: true, assignments };
}
