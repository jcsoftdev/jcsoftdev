/**
 * TDD RED → GREEN — isActive unit tests
 *
 * Phase 3, Task 3.1: Tests for the isActive() helper in active-link.ts.
 * Covers path-matching rules per design §11 / Scenarios 11.2–11.4:
 *   - Exact match for '/' (root is never a prefix match for other routes)
 *   - '/portfolio' matches '/portfolio' and '/portfolio/*'
 *   - '/blog' matches '/blog' and '/blog/*'
 *   - No cross-route leakage
 *
 * Design decision: subpath match for /portfolio/* and /blog/* returns true.
 * While the site currently has no subpaths under /portfolio, the rule is
 * defined in the spec for forward compatibility (blog slugs exist today).
 */

import { describe, expect, it } from 'vitest';
import { isActive } from './active-link.js';

// ---------------------------------------------------------------------------
// Root route — exact match only
// ---------------------------------------------------------------------------
describe('isActive — root route', () => {
  it('returns true when both currentPath and linkHref are "/"', () => {
    expect(isActive('/', '/')).toBe(true);
  });

  it('returns false when currentPath is "/portfolio" and linkHref is "/"', () => {
    expect(isActive('/portfolio', '/')).toBe(false);
  });

  it('returns false when currentPath is "/blog" and linkHref is "/"', () => {
    expect(isActive('/blog', '/')).toBe(false);
  });

  it('returns false when currentPath is "/" and linkHref is "/portfolio"', () => {
    expect(isActive('/', '/portfolio')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /portfolio — exact + subpath
// ---------------------------------------------------------------------------
describe('isActive — /portfolio route', () => {
  it('returns true for exact match "/portfolio"', () => {
    expect(isActive('/portfolio', '/portfolio')).toBe(true);
  });

  it('returns true for subpath "/portfolio/something"', () => {
    expect(isActive('/portfolio/something', '/portfolio')).toBe(true);
  });

  it('returns false for "/portfolio" when linkHref is "/blog"', () => {
    expect(isActive('/portfolio', '/blog')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// /blog — exact + subpath
// ---------------------------------------------------------------------------
describe('isActive — /blog route', () => {
  it('returns true for exact match "/blog"', () => {
    expect(isActive('/blog', '/blog')).toBe(true);
  });

  it('returns true for subpath "/blog/some-slug"', () => {
    expect(isActive('/blog/some-slug', '/blog')).toBe(true);
  });

  it('returns false for "/blog" when linkHref is "/portfolio"', () => {
    expect(isActive('/blog', '/portfolio')).toBe(false);
  });
});
