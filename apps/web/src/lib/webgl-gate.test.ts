import { describe, expect, it } from 'vitest';
import { shouldMountWebgl } from './webgl-gate';

describe('shouldMountWebgl', () => {
  it.each([
    ['no signals', {}, true],
    ['capable desktop', { saveData: false, deviceMemory: 8, coarsePointer: false }, true],
    ['memory API missing', { saveData: false, coarsePointer: false }, true],
    ['data saver on', { saveData: true, deviceMemory: 8 }, false],
    ['4 GB device', { deviceMemory: 4 }, false],
    ['2 GB device', { deviceMemory: 2 }, false],
    ['coarse primary pointer', { deviceMemory: 8, coarsePointer: true }, false],
    ['several reasons at once', { saveData: true, deviceMemory: 1, coarsePointer: true }, false],
  ])('%s', (_name, signals, expected) => {
    expect(shouldMountWebgl(signals)).toBe(expected);
  });
});
