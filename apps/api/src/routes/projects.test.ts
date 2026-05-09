/**
 * TDD RED — Admin projects CRUD route tests
 *
 * Uses mock DB and mock Valkey — no Testcontainers.
 *
 * Covers:
 *   GET    /api/v1/projects     — list, offset pagination
 *   POST   /api/v1/projects     — create; 201; 409 slug collision; 401 unauth
 *   GET    /api/v1/projects/:id — single; 404 not found; 401 unauth
 *   PATCH  /api/v1/projects/:id — update; 200; 404 not found; 401 unauth; cache invalidated
 *   DELETE /api/v1/projects/:id — hard delete; 204; 404 not found; 401 unauth; cache invalidated
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { ValkeyClient } from '../lib/valkey.js';
import { createProjectsRouter } from './projects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJ_ID = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID = 'user-123';

const sampleProject = {
  id: PROJ_ID,
  slug: 'my-project',
  name: 'My Project',
  summary: 'A great project',
  description: '## Hello',
  repoUrl: null,
  liveUrl: null,
  featuredOrder: 1,
  startedAt: '2024-01-01',
  endedAt: null,
  heroMediaId: null,
  createdAt: new Date('2024-01-01'),
};

function mockSession(userId = USER_ID) {
  return { token: 'tok-abc', userId };
}

function mockUser(id = USER_ID) {
  return { id, email: 'admin@example.com' };
}

function createMockDb(): DbClient {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {},
  } as unknown as DbClient;
}

function createMockValkey(): ValkeyClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

function buildApp(db: DbClient, valkey: ValkeyClient, authenticated = true) {
  const app = new Hono();

  // Inject session (mimics authMiddleware)
  app.use('*', async (c, next) => {
    if (authenticated) {
      (c as any).set('auth_session', mockSession());
      (c as any).set('auth_user', mockUser());
    } else {
      (c as any).set('auth_session', null);
      (c as any).set('auth_user', null);
    }
    await next();
  });

  app.route('/api/v1/projects', createProjectsRouter(db, valkey));
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/v1/projects
// ---------------------------------------------------------------------------

describe('GET /api/v1/projects', () => {
  it('returns 200 with items and total', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const itemChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([sampleProject]),
    };
    const countChain = {
      from: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(itemChain as any)
      .mockReturnValueOnce(countChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/projects');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total', 1);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request('/api/v1/projects');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/projects
// ---------------------------------------------------------------------------

describe('POST /api/v1/projects', () => {
  it('creates a project and returns 201', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no slug collision
    };
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([sampleProject]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'my-project',
        name: 'My Project',
        summary: 'A great project',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('id', PROJ_ID);

    // Cache should be invalidated after successful create
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 409 on slug collision', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleProject]), // slug exists
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'my-project',
        name: 'My Project',
        summary: 'Summary',
      }),
    });

    expect(res.status).toBe(409);
    // Cache must NOT be invalidated on failed write
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 422 on invalid body (missing required fields)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey);

    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'my-project' }), // missing name + summary
    });

    expect(res.status).toBe(422);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);

    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'my-project', name: 'My Project', summary: 'Summary' }),
    });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// REQ-CACHE-3: failed DB write must NOT invalidate cache
// ---------------------------------------------------------------------------

describe('REQ-CACHE-3: failed DB write does not invalidate cache', () => {
  it('POST — DB insert throws: cache NOT invalidated (del not called)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // No slug collision
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    // DB insert throws
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'new-project', name: 'New Project', summary: 'Summary' }),
    });

    // Hono returns 500 on unhandled throws
    expect(res.status).toBe(500);
    // Cache MUST NOT be invalidated
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('PATCH — DB update throws: cache NOT invalidated (del not called)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Project exists
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleProject]),
    };
    // DB update throws
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    expect(res.status).toBe(500);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('DELETE — DB delete throws: cache NOT invalidated (del not called)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Project exists
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: PROJ_ID }]),
    };
    // DB delete throws
    const deleteChain = {
      where: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.delete).mockReturnValue(deleteChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(500);
    expect(valkey.del).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/projects/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/projects/:id', () => {
  it('returns 200 with the project', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleProject]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(PROJ_ID);
  });

  it('returns 404 when project not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/projects/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/projects/:id', () => {
  it('updates a project and returns 200; cache invalidated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const updated = { ...sampleProject, name: 'Updated Name' };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleProject]),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.name).toBe('Updated Name');
    // Cache invalidated
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 404 when project not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(res.status).toBe(404);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/projects/:id (HARD DELETE)
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/projects/:id', () => {
  it('hard-deletes a project and returns 204; cache invalidated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: PROJ_ID }]),
    };
    const deleteChain = {
      where: vi.fn().mockResolvedValue([{ id: PROJ_ID }]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.delete).mockReturnValue(deleteChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 404 when project not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/projects/${PROJ_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
