import { describe, expect, it } from 'vitest';
import { projectPeriod } from './project-period.js';

describe('projectPeriod', () => {
  it('spans start and end years', () => {
    expect(projectPeriod('2023-10-01', '2024-11-01')).toBe('2023 — 2024');
  });

  it('collapses a single-year project', () => {
    expect(projectPeriod('2025-01-01', '2025-09-01')).toBe('2025');
  });

  it('marks an ongoing project', () => {
    expect(projectPeriod('2026-05-01', null)).toBe('2026 — now');
  });

  it('is null without a start date', () => {
    expect(projectPeriod(null, '2025-01-01')).toBeNull();
  });
});
