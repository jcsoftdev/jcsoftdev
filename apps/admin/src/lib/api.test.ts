/**
 * TDD RED → GREEN — resolveApiUrl unit tests (admin / Vite SPA)
 *
 * Phase 2, Task 2.3: Tests for the resolveApiUrl() helper in admin api.ts.
 * Covers the three scenarios from design §6 / Scenarios 8.1–8.3:
 *   8.1 PROD + missing env → throws with helpful message
 *   8.2 DEV + missing env → returns localhost:8787 and warns
 *   8.3 env set → returns exact value
 *
 * Admin uses VITE_API_URL (standard Vite env var prefix) and checks
 * import.meta.env.MODE === 'production' per Vite canonical docs.
 *
 * import.meta.env mocking in Vitest 4:
 * - vi.stubEnv(key, value) correctly intercepts import.meta.env reads since
 *   Vitest uses a proxy for import.meta.env in test environments.
 * - We import resolveApiUrl statically to avoid re-triggering the module-level
 *   api initialization under production stubs.
 * - afterEach cleans up stubs.
 *
 * NOTE: We do NOT test projectsClient, experiencesClient, etc. here.
 * Only resolveApiUrl is exercised.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiUrl } from './api.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Scenario 8.3 — VITE_API_URL is set → returns exact value
// ---------------------------------------------------------------------------
describe('resolveApiUrl — env var set', () => {
  it('returns the VITE_API_URL value when set', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');
    vi.stubEnv('MODE', 'development');

    expect(resolveApiUrl()).toBe('https://api.example.com');
  });
});

// ---------------------------------------------------------------------------
// Scenario 8.1 — PROD + missing env → throws
// ---------------------------------------------------------------------------
describe('resolveApiUrl — production without env var', () => {
  it('throws with a helpful message when VITE_API_URL is missing in prod', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('MODE', 'production');

    expect(() => resolveApiUrl()).toThrow('VITE_API_URL must be set in production builds');
  });
});

// ---------------------------------------------------------------------------
// Scenario 8.2 — DEV + missing env → returns localhost:8787 + warns
// ---------------------------------------------------------------------------
describe('resolveApiUrl — development without env var', () => {
  it('returns http://localhost:8787 and warns when VITE_API_URL is missing in dev', () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('MODE', 'development');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = resolveApiUrl();

    expect(result).toBe('http://localhost:8787');
    expect(warnSpy).toHaveBeenCalledWith(
      '[api] VITE_API_URL not set; defaulting to http://localhost:8787'
    );

    warnSpy.mockRestore();
  });
});
