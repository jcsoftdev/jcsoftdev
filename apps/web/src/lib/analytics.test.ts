/**
 * TDD RED → GREEN — resolvePlausibleHost unit tests (web / Astro)
 *
 * H8 remediation: Plausible analytics script was never embedded despite
 * PUBLIC_PLAUSIBLE_HOST being wired end-to-end (Dockerfile ARG/ENV, .env).
 * resolvePlausibleHost() follows the ADR-16 env resolution shape (a
 * testable function, not a top-level expression) but deliberately does NOT
 * hard-fail when unset — analytics is optional, unlike the API URL.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePlausibleHost } from './analytics.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolvePlausibleHost — env var set', () => {
  it('returns the PUBLIC_PLAUSIBLE_HOST value when set', () => {
    vi.stubEnv('PUBLIC_PLAUSIBLE_HOST', 'https://analytics.jcsoftdev.com');

    expect(resolvePlausibleHost()).toBe('https://analytics.jcsoftdev.com');
  });
});

describe('resolvePlausibleHost — env var missing', () => {
  it('returns undefined without throwing in development', () => {
    vi.stubEnv('PUBLIC_PLAUSIBLE_HOST', '');
    vi.stubEnv('MODE', 'development');

    expect(resolvePlausibleHost()).toBeUndefined();
  });

  it('returns undefined without throwing in production (no hard failure)', () => {
    vi.stubEnv('PUBLIC_PLAUSIBLE_HOST', '');
    vi.stubEnv('MODE', 'production');

    expect(resolvePlausibleHost()).toBeUndefined();
  });
});
