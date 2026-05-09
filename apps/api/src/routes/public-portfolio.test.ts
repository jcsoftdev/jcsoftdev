/**
 * TDD RED — Public portfolio routes tests
 *
 * Covers:
 *   GET /api/v1/public/portfolio           → combined payload
 *   GET /api/v1/public/portfolio/projects  → projects slice
 *   GET /api/v1/public/portfolio/experiences → experiences slice
 *
 * Scenarios per design §3 and spec REQ-API-1/2/3:
 *   - empty DB → empty arrays
 *   - with data → correctly ordered (projects: featuredOrder ASC NULLS LAST; experiences: displayOrder ASC)
 *   - cache hit → second call uses cache (DB not queried again)
 *   - cache miss → populates cache
 *   - sanitization applied (descriptionHtml present, no raw <script>)
 *   - heroImageUrl built for projects with heroMediaId
 *   - heroImageUrl null for projects without heroMediaId
 *   - no auth required
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { ValkeyClient } from '../lib/valkey.js';
import { createPublicPortfolioRouter } from './public-portfolio.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const PROJ_ID = '550e8400-e29b-41d4-a716-446655440001';
const EXP_ID = '550e8400-e29b-41d4-a716-446655440002';
const MEDIA_ID = '550e8400-e29b-41d4-a716-446655440003';

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJ_ID,
    slug: 'my-project',
    name: 'My Project',
    summary: 'A great project',
    description: '## Hello\n\nWorld',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 1,
    startedAt: '2024-01-01',
    endedAt: null,
    heroMediaId: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeExperience(overrides: Record<string, unknown> = {}) {
  return {
    id: EXP_ID,
    company: 'ACME Corp',
    role: 'Software Engineer',
    summary: 'Led backend work',
    startedAt: '2023-01-01',
    endedAt: null,
    location: 'Lima, Peru',
    displayOrder: 1,
    createdAt: new Date('2023-01-01'),
    ...overrides,
  };
}

function createMockDb(overrides: Record<string, unknown> = {}): DbClient {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {},
    ...overrides,
  } as unknown as DbClient;
}

function createMockValkey(overrides: Partial<ValkeyClient> = {}): ValkeyClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function buildApp(db: DbClient, valkey: ValkeyClient, minioPublicBase?: string) {
  const app = new Hono();
  app.route('/api/v1/public/portfolio', createPublicPortfolioRouter(db, valkey, minioPublicBase));
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/v1/public/portfolio (combined)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/portfolio', () => {
  it('returns 200 with projects and experiences arrays', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Two DB calls: one for projects, one for experiences
    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([makeProject()]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([makeExperience()]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey, 'http://localhost:9000');
    const res = await app.request('/api/v1/public/portfolio');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('projects');
    expect(body).toHaveProperty('experiences');
    expect(Array.isArray(body.projects.items)).toBe(true);
    expect(Array.isArray(body.experiences.items)).toBe(true);
  });

  it('returns empty arrays when DB is empty', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.projects.items).toEqual([]);
    expect(body.experiences.items).toEqual([]);
  });

  it('returns cached payload on cache hit (DB not called)', async () => {
    const cachedPayload = {
      projects: { items: [{ id: 'cached-proj' }] },
      experiences: { items: [] },
    };
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedPayload)),
    });
    const db = createMockDb();

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio');

    expect(res.status).toBe(200);
    expect(db.select).not.toHaveBeenCalled();
    const body = (await res.json()) as any;
    expect(body.projects.items[0].id).toBe('cached-proj');
  });

  it('writes to cache on cache miss', async () => {
    const db = createMockDb();
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(null),
    });

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    await app.request('/api/v1/public/portfolio');

    expect(valkey.set).toHaveBeenCalledWith('public:portfolio:v1', expect.any(String), 300);
  });

  it('does not require authentication', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    // No auth header — should still be 200
    const res = await app.request('/api/v1/public/portfolio');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/portfolio/projects (slice)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/portfolio/projects', () => {
  it('returns items array from combined cache', async () => {
    const cachedPayload = {
      projects: { items: [{ id: 'proj-1', slug: 'p1', name: 'Project 1' }] },
      experiences: { items: [] },
    };
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedPayload)),
    });
    const db = createMockDb();

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio/projects');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('items');
    expect(body.items[0].id).toBe('proj-1');
  });

  it('returns descriptionHtml (sanitized) in project items', async () => {
    const db = createMockDb();
    const valkey = createMockValkey({ get: vi.fn().mockResolvedValue(null) });

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi
        .fn()
        .mockResolvedValue([makeProject({ description: '<script>alert(1)</script># Hello' })]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio/projects');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const item = body.items[0];
    expect(item).toHaveProperty('descriptionHtml');
    expect(item.descriptionHtml).not.toContain('<script>');
    expect(item.descriptionHtml).not.toContain('alert(1)');
  });

  it('returns heroImageUrl as string when project has heroMediaId', async () => {
    const db = createMockDb();
    const valkey = createMockValkey({ get: vi.fn().mockResolvedValue(null) });

    // project.heroMediaId is set; the leftJoin will return the media objectKey
    const projRow = {
      project: makeProject({ heroMediaId: MEDIA_ID }),
      media: { objectKey: 'posts/user/2026/img.jpg', bucket: 'posts-media' },
    };

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([projRow]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey, 'http://localhost:9000');
    const res = await app.request('/api/v1/public/portfolio/projects');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.items[0].heroImageUrl).toBe('string');
    expect(body.items[0].heroImageUrl).toContain('img.jpg');
  });

  it('returns heroImageUrl as null when project has no heroMediaId', async () => {
    const db = createMockDb();
    const valkey = createMockValkey({ get: vi.fn().mockResolvedValue(null) });

    // No leftJoin media match
    const projRow = {
      project: makeProject({ heroMediaId: null }),
      media: null,
    };

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([projRow]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio/projects');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items[0].heroImageUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/portfolio/experiences (slice)
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/portfolio/experiences', () => {
  it('returns items array from combined cache', async () => {
    const cachedPayload = {
      projects: { items: [] },
      experiences: { items: [{ id: 'exp-1', company: 'ACME' }] },
    };
    const valkey = createMockValkey({
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedPayload)),
    });
    const db = createMockDb();

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio/experiences');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items[0].company).toBe('ACME');
  });

  it('returns summaryHtml (sanitized) in experience items', async () => {
    const db = createMockDb();
    const valkey = createMockValkey({ get: vi.fn().mockResolvedValue(null) });

    const projChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    const expChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi
        .fn()
        .mockResolvedValue([makeExperience({ summary: '<img onerror="evil()" /> **led team**' })]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(projChain as any)
      .mockReturnValueOnce(expChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/portfolio/experiences');

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const item = body.items[0];
    expect(item).toHaveProperty('summaryHtml');
    expect(item.summaryHtml).not.toContain('onerror');
  });
});
