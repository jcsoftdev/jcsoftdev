import { describe, expect, it } from 'vitest';
import { drawAssignments, type Exclusions } from './draw';

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function exclusionsOf(entries: Record<string, string[]>): Exclusions {
  return new Map(Object.entries(entries).map(([giver, banned]) => [giver, new Set(banned)]));
}

const people = ['ana', 'beto', 'carla', 'diego', 'elena', 'fabio'];

describe('drawAssignments', () => {
  it('gives every person exactly one other person across many draws', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = drawAssignments(people, new Map(), seededRandom(seed));
      if (!result.ok) throw new Error('draw should succeed');
      const receivers = [...result.assignments.values()];
      expect(new Set(receivers)).toEqual(new Set(people));
      for (const [giver, receiver] of result.assignments) expect(giver).not.toBe(receiver);
    }
  });

  it('never gives someone a person they are not allowed to meet', () => {
    const exclusions = exclusionsOf({
      ana: ['beto', 'carla', 'diego'],
      beto: ['ana', 'elena'],
      fabio: ['ana', 'beto', 'carla'],
    });
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = drawAssignments(people, exclusions, seededRandom(seed));
      if (!result.ok) throw new Error('draw should succeed');
      for (const [giver, receiver] of result.assignments) {
        expect(exclusions.get(giver)?.has(receiver) ?? false).toBe(false);
      }
    }
  });

  it('finds the only valid draw when exclusions leave a single option', () => {
    const exclusions = exclusionsOf({
      ana: ['beto'],
      beto: ['carla'],
      carla: ['ana'],
    });
    const result = drawAssignments(['ana', 'beto', 'carla'], exclusions, seededRandom(7));
    if (!result.ok) throw new Error('draw should succeed');
    expect(Object.fromEntries(result.assignments)).toEqual({
      ana: 'carla',
      beto: 'ana',
      carla: 'beto',
    });
  });

  it('reports the people who block an impossible draw', () => {
    const exclusions = exclusionsOf({ beto: ['carla'], carla: ['beto'] });
    const result = drawAssignments(['ana', 'beto', 'carla'], exclusions, seededRandom(3));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([...result.blocked].sort()).toEqual(['beto', 'carla']);
  });

  it('reports a person who cannot give to anyone', () => {
    const exclusions = exclusionsOf({ ana: ['beto', 'carla'] });
    const result = drawAssignments(['ana', 'beto', 'carla'], exclusions, seededRandom(5));
    expect(result).toEqual({ ok: false, blocked: ['ana'] });
  });
});
