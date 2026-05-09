import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

type AnyRecord = Record<string, unknown>;
type ColRecord = Record<string, { notNull?: boolean }>;

describe('projects + experiences schema', () => {
  it('exports projects table', async () => {
    const { projects } = await import('./projects.js');
    expect(projects).toBeDefined();
  });

  it('exports experiences table', async () => {
    const { experiences } = await import('./experiences.js');
    expect(experiences).toBeDefined();
  });

  it('projects table has expected columns', async () => {
    const { projects } = await import('./projects.js');
    const columns = Object.keys(projects);
    expect(columns).toContain('id');
    expect(columns).toContain('slug');
    expect(columns).toContain('name');
    expect(columns).toContain('summary');
    expect(columns).toContain('description');
    expect(columns).toContain('repoUrl');
    expect(columns).toContain('liveUrl');
    expect(columns).toContain('featuredOrder');
    expect(columns).toContain('startedAt');
    expect(columns).toContain('endedAt');
    expect(columns).toContain('createdAt');
  });

  it('projects.slug uses citext (case-insensitive)', async () => {
    const { projects } = await import('./projects.js');
    const slugCol = (projects as unknown as AnyRecord).slug as {
      dataType?: string;
    };
    expect(slugCol.dataType).toBe('custom');
  });

  it('projects.slug is unique', async () => {
    const { projects } = await import('./projects.js');
    const slugCol = (projects as unknown as AnyRecord).slug as {
      isUnique?: boolean;
    };
    expect(slugCol.isUnique).toBe(true);
  });

  it('projects.featuredOrder is nullable (integer)', async () => {
    const { projects } = await import('./projects.js');
    const featuredOrderCol = (projects as unknown as ColRecord).featuredOrder;
    // featuredOrder is nullable — notNull must be false/undefined
    expect(featuredOrderCol?.notNull).toBeFalsy();
  });

  // --- Task 1.1: heroMediaId column + FK ---

  it('projects table has heroMediaId column', async () => {
    const { projects } = await import('./projects.js');
    const columns = Object.keys(projects);
    expect(columns).toContain('heroMediaId');
  });

  it('projects.heroMediaId is nullable', async () => {
    const { projects } = await import('./projects.js');
    const heroMediaIdCol = (projects as unknown as ColRecord).heroMediaId;
    expect(heroMediaIdCol?.notNull).toBeFalsy();
  });

  it('projects.heroMediaId has uuid dataType', async () => {
    const { projects } = await import('./projects.js');
    const heroMediaIdCol = (projects as unknown as AnyRecord).heroMediaId as {
      dataType?: string;
    };
    expect(heroMediaIdCol.dataType).toBe('string');
  });

  it('projects.heroMediaId FK references media(id) with ON DELETE SET NULL', async () => {
    const { projects } = await import('./projects.js');
    const tableConfig = getTableConfig(projects);
    const fks = tableConfig.foreignKeys;
    const heroFk = fks.find((fk) => fk.reference().columns.some((c) => c.name === 'hero_media_id'));
    expect(heroFk).toBeDefined();
    const ref = heroFk?.reference();
    expect(ref?.foreignColumns[0]?.name).toBe('id');
    // ON DELETE SET NULL
    expect(heroFk?.onDelete).toBe('set null');
  });

  it('schema barrel exports projects with heroMediaId', async () => {
    const barrel = await import('./index.js');
    const { projects } = barrel as unknown as { projects: AnyRecord };
    expect((projects as unknown as AnyRecord).heroMediaId).toBeDefined();
  });

  // --- Task 1.2: composite index on (featuredOrder ASC NULLS LAST, startedAt DESC) ---

  it('projects table has composite index on featuredOrder + startedAt', async () => {
    const { projects } = await import('./projects.js');
    const tableConfig = getTableConfig(projects);
    const indexes = tableConfig.indexes;
    // There should be at least 2 indexes: existing featured_order_idx + new composite
    expect(indexes.length).toBeGreaterThanOrEqual(2);
    // The composite index must reference both featuredOrder and startedAt columns
    const compositeIdx = indexes.find((idx) => {
      const cols = idx.config.columns.map((c) => ('name' in c ? c.name : ''));
      return cols.includes('featured_order') && cols.includes('started_at');
    });
    expect(compositeIdx).toBeDefined();
  });

  // --- Existing tests ---

  it('experiences table has expected columns', async () => {
    const { experiences } = await import('./experiences.js');
    const columns = Object.keys(experiences);
    expect(columns).toContain('id');
    expect(columns).toContain('company');
    expect(columns).toContain('role');
    expect(columns).toContain('summary');
    expect(columns).toContain('startedAt');
    expect(columns).toContain('endedAt');
    expect(columns).toContain('location');
    expect(columns).toContain('displayOrder');
    expect(columns).toContain('createdAt');
  });

  it('experiences.startedAt is NOT NULL', async () => {
    const { experiences } = await import('./experiences.js');
    const startedAtCol = (experiences as unknown as ColRecord).startedAt;
    expect(startedAtCol?.notNull).toBe(true);
  });

  it('experiences.endedAt is nullable', async () => {
    const { experiences } = await import('./experiences.js');
    const endedAtCol = (experiences as unknown as ColRecord).endedAt;
    expect(endedAtCol?.notNull).toBeFalsy();
  });

  it('barrel exports projects and experiences', async () => {
    const barrel = await import('./index.js');
    expect((barrel as unknown as AnyRecord).projects).toBeDefined();
    expect((barrel as unknown as AnyRecord).experiences).toBeDefined();
  });
});
