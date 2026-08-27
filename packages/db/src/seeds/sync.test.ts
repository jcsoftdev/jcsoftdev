/**
 * Unit tests for sync.ts — the production guard and the superseded-slug list.
 *
 * No DB required; the row-level behaviour lives in sync.integration.test.ts.
 *
 * The guard mirrors reset.ts (ADR-17) and is tested separately rather than
 * shared, because `sync` is destructive in a different way — it overwrites rows
 * and deletes superseded ones — and must never inherit a weakened guard by
 * accident.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedProjects } from './data.js';
import { checkProductionGuard, SUPERSEDED_PROJECT_SLUGS } from './sync.js';

describe('checkProductionGuard', () => {
  let originalNodeEnv: string | undefined;
  let originalArgv: string[];

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalArgv = process.argv;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    process.argv = originalArgv;
  });

  it('throws when NODE_ENV=production and --confirm flag is absent', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'sync.ts'];

    expect(() => checkProductionGuard()).toThrowError(/production/i);
  });

  it('error message mentions --confirm flag as the recovery path', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'sync.ts'];

    expect(() => checkProductionGuard()).toThrowError(/--confirm/);
  });

  it('does NOT throw when NODE_ENV=development and --confirm is absent', () => {
    process.env.NODE_ENV = 'development';
    process.argv = ['node', 'sync.ts'];

    expect(() => checkProductionGuard()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV=production and --confirm flag is present', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'sync.ts', '--confirm'];

    expect(() => checkProductionGuard()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV is absent and --confirm is absent', () => {
    delete process.env.NODE_ENV;
    process.argv = ['node', 'sync.ts'];

    expect(() => checkProductionGuard()).not.toThrow();
  });
});

describe('SUPERSEDED_PROJECT_SLUGS', () => {
  // A slug in both lists would be inserted and then deleted in the same
  // transaction — the project would silently vanish from the portfolio.
  it('shares no slug with the current seed data', () => {
    const current = new Set(seedProjects.map((p) => p.slug));
    const overlap = SUPERSEDED_PROJECT_SLUGS.filter((slug) => current.has(slug));

    expect(overlap).toEqual([]);
  });

  it('contains no duplicates', () => {
    expect(new Set(SUPERSEDED_PROJECT_SLUGS).size).toBe(SUPERSEDED_PROJECT_SLUGS.length);
  });
});
