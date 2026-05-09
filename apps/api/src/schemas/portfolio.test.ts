/**
 * TDD RED — Portfolio Zod 4 schema tests
 *
 * Covers:
 *   - CreateProjectSchema: valid input passes; required fields missing → fail
 *   - UpdateProjectSchema: partial; negative featuredOrder → fail
 *   - CreateExperienceSchema: valid; missing required field → fail
 *   - UpdateExperienceSchema: partial updates allowed
 *   - ListQuerySchema: defaults applied correctly
 */

import { describe, expect, it } from 'vitest';
import {
  CreateExperienceSchema,
  CreateProjectSchema,
  ProjectListQuerySchema,
  UpdateExperienceSchema,
  UpdateProjectSchema,
} from './portfolio.js';

// ---------------------------------------------------------------------------
// CreateProjectSchema
// ---------------------------------------------------------------------------

describe('CreateProjectSchema', () => {
  it('accepts valid minimal input (slug + name + summary)', () => {
    const result = CreateProjectSchema.safeParse({
      slug: 'my-project',
      name: 'My Project',
      summary: 'A short summary',
    });
    expect(result.success).toBe(true);
  });

  it('accepts full input with all optional fields', () => {
    const result = CreateProjectSchema.safeParse({
      slug: 'full-project',
      name: 'Full Project',
      summary: 'Summary',
      description: '## Description\n\nMarkdown content',
      repoUrl: 'https://github.com/user/repo',
      liveUrl: 'https://example.com',
      featuredOrder: 1,
      startedAt: '2024-01-01',
      endedAt: '2024-12-31',
      heroMediaId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing slug', () => {
    const result = CreateProjectSchema.safeParse({
      name: 'My Project',
      summary: 'Summary',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = CreateProjectSchema.safeParse({
      slug: 'my-project',
      summary: 'Summary',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid heroMediaId (not a UUID)', () => {
    const result = CreateProjectSchema.safeParse({
      slug: 'my-project',
      name: 'My Project',
      summary: 'Summary',
      heroMediaId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative featuredOrder', () => {
    const result = CreateProjectSchema.safeParse({
      slug: 'my-project',
      name: 'My Project',
      summary: 'Summary',
      featuredOrder: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateProjectSchema
// ---------------------------------------------------------------------------

describe('UpdateProjectSchema', () => {
  it('accepts partial update (only name)', () => {
    const result = UpdateProjectSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no-op update)', () => {
    const result = UpdateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts heroMediaId as null (clear hero)', () => {
    const result = UpdateProjectSchema.safeParse({ heroMediaId: null });
    expect(result.success).toBe(true);
  });

  it('rejects negative featuredOrder', () => {
    const result = UpdateProjectSchema.safeParse({ featuredOrder: -5 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreateExperienceSchema
// ---------------------------------------------------------------------------

describe('CreateExperienceSchema', () => {
  it('accepts valid minimal input', () => {
    const result = CreateExperienceSchema.safeParse({
      company: 'ACME Corp',
      role: 'Software Engineer',
      startedAt: '2023-01-01',
      displayOrder: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts full input with optional fields', () => {
    const result = CreateExperienceSchema.safeParse({
      company: 'ACME Corp',
      role: 'Software Engineer',
      summary: 'Led backend team',
      startedAt: '2023-01-01',
      endedAt: '2024-06-30',
      location: 'Lima, Peru',
      displayOrder: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing company', () => {
    const result = CreateExperienceSchema.safeParse({
      role: 'Engineer',
      startedAt: '2023-01-01',
      displayOrder: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing role', () => {
    const result = CreateExperienceSchema.safeParse({
      company: 'ACME',
      startedAt: '2023-01-01',
      displayOrder: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing startedAt', () => {
    const result = CreateExperienceSchema.safeParse({
      company: 'ACME',
      role: 'Engineer',
      displayOrder: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing displayOrder', () => {
    const result = CreateExperienceSchema.safeParse({
      company: 'ACME',
      role: 'Engineer',
      startedAt: '2023-01-01',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateExperienceSchema
// ---------------------------------------------------------------------------

describe('UpdateExperienceSchema', () => {
  it('accepts partial update (only company)', () => {
    const result = UpdateExperienceSchema.safeParse({ company: 'New Corp' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = UpdateExperienceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts endedAt as null (clear end date)', () => {
    const result = UpdateExperienceSchema.safeParse({ endedAt: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ProjectListQuerySchema
// ---------------------------------------------------------------------------

describe('ProjectListQuerySchema', () => {
  it('applies default limit=20 and offset=0', () => {
    const result = ProjectListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('accepts explicit limit and offset', () => {
    const result = ProjectListQuerySchema.safeParse({ limit: '10', offset: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(20);
    }
  });
});
