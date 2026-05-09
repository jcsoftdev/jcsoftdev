/**
 * Unit tests for the reset.ts production guard logic.
 *
 * Tests the exported `checkProductionGuard` function (no DB required).
 * Covers ADR-17: NODE_ENV=production + missing --confirm flag → throws.
 *
 * Scenarios:
 * 6.1 — NODE_ENV=production without --confirm → throws with "production" in message
 * 6.2 — NODE_ENV=development without --confirm → does not throw
 * 6.3 — NODE_ENV=production with --confirm flag → does not throw
 * 6.4 — NODE_ENV absent without --confirm → does not throw (non-production = safe)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkProductionGuard } from './reset.js';

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
    process.argv = ['node', 'reset.ts'];

    expect(() => checkProductionGuard()).toThrowError(/production/i);
  });

  it('error message mentions --confirm flag as the recovery path', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'reset.ts'];

    expect(() => checkProductionGuard()).toThrowError(/--confirm/);
  });

  it('does NOT throw when NODE_ENV=development and --confirm is absent', () => {
    process.env.NODE_ENV = 'development';
    process.argv = ['node', 'reset.ts'];

    expect(() => checkProductionGuard()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV=production and --confirm flag is present', () => {
    process.env.NODE_ENV = 'production';
    process.argv = ['node', 'reset.ts', '--confirm'];

    expect(() => checkProductionGuard()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV is absent and --confirm is absent', () => {
    delete process.env.NODE_ENV;
    process.argv = ['node', 'reset.ts'];

    expect(() => checkProductionGuard()).not.toThrow();
  });
});
