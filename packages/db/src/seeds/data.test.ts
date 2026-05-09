/**
 * Shape-validation unit tests for seed data arrays.
 *
 * These tests run WITHOUT a database — they validate that the exported arrays
 * in data.ts satisfy all structural invariants required by REQ-IDEMPOTENT-2 /
 * Scenario 4.1 before any DB operation is attempted.
 *
 * Checks:
 * - Every experience has required fields (company, role, startedAt, displayOrder)
 * - Every project has required fields (slug, name, summary, startedAt)
 * - displayOrder values are unique across all experiences
 * - slug values are unique across all projects
 * - All date strings (startedAt / endedAt when non-null) parse as valid ISO YYYY-MM-DD
 * - Exactly 3 projects have a non-null featuredOrder
 */

import { describe, expect, it } from 'vitest';
import { seedExperiences, seedProjects } from './data.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

describe('seedExperiences shape', () => {
  it('exports exactly 8 experience rows', () => {
    expect(seedExperiences).toHaveLength(8);
  });

  it('every experience has company, role, startedAt, displayOrder', () => {
    for (const exp of seedExperiences) {
      expect(exp.company, `company missing in row displayOrder=${exp.displayOrder}`).toBeTruthy();
      expect(exp.role, `role missing in row displayOrder=${exp.displayOrder}`).toBeTruthy();
      expect(
        exp.startedAt,
        `startedAt missing in row displayOrder=${exp.displayOrder}`
      ).toBeTruthy();
      expect(exp.displayOrder, `displayOrder missing in row company=${exp.company}`).toBeDefined();
    }
  });

  it('displayOrder values are unique', () => {
    const orders = seedExperiences.map((e) => e.displayOrder);
    const unique = new Set(orders);
    expect(unique.size).toBe(seedExperiences.length);
  });

  it('displayOrder values are 1..8 consecutive', () => {
    const orders = seedExperiences.map((e) => e.displayOrder).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('all startedAt dates are valid YYYY-MM-DD strings', () => {
    for (const exp of seedExperiences) {
      expect(
        isValidDate(exp.startedAt as string),
        `invalid startedAt "${exp.startedAt}" for company=${exp.company}`
      ).toBe(true);
    }
  });

  it('all non-null endedAt dates are valid YYYY-MM-DD strings', () => {
    for (const exp of seedExperiences) {
      if (exp.endedAt != null) {
        expect(
          isValidDate(exp.endedAt as string),
          `invalid endedAt "${exp.endedAt}" for company=${exp.company}`
        ).toBe(true);
      }
    }
  });

  it('exactly one experience has null endedAt (the current/open role)', () => {
    const openRoles = seedExperiences.filter((e) => e.endedAt == null);
    expect(openRoles).toHaveLength(1);
    expect(openRoles[0]?.displayOrder).toBe(1);
  });
});

describe('seedProjects shape', () => {
  it('exports exactly 6 project rows', () => {
    expect(seedProjects).toHaveLength(6);
  });

  it('every project has slug, name, summary, startedAt', () => {
    for (const proj of seedProjects) {
      expect(proj.slug, `slug missing in project name=${proj.name}`).toBeTruthy();
      expect(proj.name, `name missing in project slug=${proj.slug}`).toBeTruthy();
      expect(proj.summary, `summary missing in project slug=${proj.slug}`).toBeTruthy();
      expect(proj.startedAt, `startedAt missing in project slug=${proj.slug}`).toBeTruthy();
    }
  });

  it('slug values are unique', () => {
    const slugs = seedProjects.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(seedProjects.length);
  });

  it('slug values are kebab-case URL-safe strings', () => {
    const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const proj of seedProjects) {
      expect(KEBAB_RE.test(proj.slug ?? ''), `slug "${proj.slug}" is not kebab-case`).toBe(true);
    }
  });

  it('exactly 3 projects have a non-null featuredOrder', () => {
    const featured = seedProjects.filter((p) => p.featuredOrder != null);
    expect(featured).toHaveLength(3);
  });

  it('featured projects have featuredOrder 1, 2, 3', () => {
    const orders = seedProjects
      .filter((p) => p.featuredOrder != null)
      .map((p) => p.featuredOrder)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(orders).toEqual([1, 2, 3]);
  });

  it('all startedAt dates are valid YYYY-MM-DD strings', () => {
    for (const proj of seedProjects) {
      expect(
        isValidDate(proj.startedAt as string),
        `invalid startedAt "${proj.startedAt}" for slug=${proj.slug}`
      ).toBe(true);
    }
  });

  it('all non-null endedAt dates are valid YYYY-MM-DD strings', () => {
    for (const proj of seedProjects) {
      if (proj.endedAt != null) {
        expect(
          isValidDate(proj.endedAt as string),
          `invalid endedAt "${proj.endedAt}" for slug=${proj.slug}`
        ).toBe(true);
      }
    }
  });

  it('heroMediaId is null for all projects', () => {
    for (const proj of seedProjects) {
      expect(proj.heroMediaId).toBeNull();
    }
  });

  it('liveUrl and repoUrl are strings or null (no undefined)', () => {
    for (const proj of seedProjects) {
      const liveUrl = proj.liveUrl;
      const repoUrl = proj.repoUrl;
      expect(liveUrl === null || typeof liveUrl === 'string').toBe(true);
      expect(repoUrl === null || typeof repoUrl === 'string').toBe(true);
    }
  });
});
