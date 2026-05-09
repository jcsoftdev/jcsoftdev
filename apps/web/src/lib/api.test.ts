/**
 * TDD RED → GREEN — resolveApiUrl unit tests (web / Astro)
 *
 * Phase 2, Task 2.1: Tests for the resolveApiUrl() helper in api.ts.
 * Covers the three scenarios from design §6 / Scenarios 7.1–7.3:
 *   7.1 PROD + missing env → throws with helpful message
 *   7.2 DEV + missing env → returns localhost:8787 and warns
 *   7.3 env set → returns exact value
 *
 * import.meta.env mocking in Vitest 4:
 * - vi.stubEnv(key, value) sets import.meta.env[key] for the duration of
 *   the test via Vitest's env proxy. Reads inside resolveApiUrl() pick up
 *   the stubbed value on every call since the function reads env lazily.
 * - We import resolveApiUrl statically (no resetModules) to avoid the
 *   module-level `api = hc(resolveApiUrl())` re-executing under prod stubs.
 * - afterEach calls vi.unstubAllEnvs() to restore original values.
 *
 * NOTE: We do NOT test the `api` export (hc<AppType> instance) directly.
 * Only resolveApiUrl is exercised here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiUrl } from './api.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Scenario 7.3 — PUBLIC_API_URL is set → returns exact value
// ---------------------------------------------------------------------------
describe('resolveApiUrl — env var set', () => {
  it('returns the PUBLIC_API_URL value when set', () => {
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('MODE', 'development');

    expect(resolveApiUrl()).toBe('https://api.example.com');
  });
});

// ---------------------------------------------------------------------------
// Scenario 7.1 — PROD + missing env → throws
// ---------------------------------------------------------------------------
describe('resolveApiUrl — production without env var', () => {
  it('throws with a helpful message when PUBLIC_API_URL is missing in prod', () => {
    vi.stubEnv('PUBLIC_API_URL', '');
    vi.stubEnv('MODE', 'production');

    expect(() => resolveApiUrl()).toThrow('PUBLIC_API_URL must be set in production builds');
  });
});

// ---------------------------------------------------------------------------
// Scenario 7.2 — DEV + missing env → returns localhost:8787 + warns
// ---------------------------------------------------------------------------
describe('resolveApiUrl — development without env var', () => {
  it('returns http://localhost:8787 and warns when PUBLIC_API_URL is missing in dev', () => {
    vi.stubEnv('PUBLIC_API_URL', '');
    vi.stubEnv('MODE', 'development');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveApiUrl();

    expect(result).toBe('http://localhost:8787');
    expect(warnSpy).toHaveBeenCalledWith(
      '[api] PUBLIC_API_URL not set; defaulting to http://localhost:8787'
    );

    warnSpy.mockRestore();
  });
});
