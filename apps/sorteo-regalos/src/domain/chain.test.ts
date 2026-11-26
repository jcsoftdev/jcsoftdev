import { describe, expect, it } from 'vitest';
import { type Assignments, insertSegment, removeFromChain } from './chain';

const cycle = new Map([
  ['a', 'b'],
  ['b', 'c'],
  ['c', 'd'],
  ['d', 'a'],
]);
const none = new Map<string, Set<string>>();
const first = () => 0;

function applied(assignments: Assignments, changes: Assignments, removed?: string) {
  const next = new Map(assignments);
  if (removed) next.delete(removed);
  for (const [giver, receiver] of changes) next.set(giver, receiver);
  return next;
}

function isSingleCycle(assignments: Assignments): boolean {
  const start = assignments.keys().next().value as string;
  const seen = new Set<string>();
  let current = start;
  do {
    if (seen.has(current)) return false;
    seen.add(current);
    current = assignments.get(current) as string;
  } while (current !== start && current !== undefined);
  return current === start && seen.size === assignments.size;
}

function isValidDerangement(assignments: Assignments): boolean {
  const receivers = [...assignments.values()];
  return (
    new Set(receivers).size === receivers.length &&
    receivers.every((receiver) => assignments.has(receiver)) &&
    [...assignments].every(([giver, receiver]) => giver !== receiver)
  );
}

describe('removeFromChain', () => {
  it("hands the leaving person's receiver to their giver", () => {
    expect(removeFromChain(cycle, 'b', none, first)).toEqual({
      ok: true,
      changes: new Map([['a', 'c']]),
    });
  });

  it('rehomes the giver when giver and receiver are the same person', () => {
    const pairs = new Map([
      ['a', 'b'],
      ['b', 'a'],
      ['c', 'd'],
      ['d', 'c'],
    ]);
    const result = removeFromChain(pairs, 'a', none, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isValidDerangement(applied(pairs, result.changes, 'a'))).toBe(true);
  });

  it('swaps with another link when the giver excludes the new receiver', () => {
    const five = new Map([
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'e'],
      ['e', 'a'],
    ]);
    const exclusions = new Map([['a', new Set(['c'])]]);
    const result = removeFromChain(five, 'b', exclusions, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = applied(five, result.changes, 'b');
    expect(isValidDerangement(next)).toBe(true);
    expect(next.get('a')).not.toBe('c');
  });
});

describe('insertSegment', () => {
  it('threads every newcomer through one existing link', () => {
    const result = insertSegment(cycle, ['e', 'f', 'g'], none, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = applied(cycle, result.changes);
    expect(isSingleCycle(next)).toBe(true);
    const earlierChanged = [...cycle].filter(([giver, receiver]) => next.get(giver) !== receiver);
    expect(earlierChanged).toHaveLength(1);
  });

  it('never pairs two newcomers with each other alone', () => {
    const result = insertSegment(cycle, ['e', 'f'], none, first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = applied(cycle, result.changes);
    expect(next.get('e') === 'f' && next.get('f') === 'e').toBe(false);
  });

  it('respects exclusions on both ends of the segment', () => {
    const exclusions = new Map([['e', new Set(['b', 'c', 'd'])]]);
    expect(insertSegment(cycle, ['e'], exclusions, first)).toEqual({
      ok: true,
      changes: new Map([
        ['d', 'e'],
        ['e', 'a'],
      ]),
    });
  });

  it('fails when no link fits', () => {
    const exclusions = new Map([['e', new Set(['a', 'b', 'c', 'd'])]]);
    expect(insertSegment(cycle, ['e'], exclusions, first).ok).toBe(false);
  });
});
