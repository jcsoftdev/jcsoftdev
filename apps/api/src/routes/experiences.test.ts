/**
 * TDD RED — Admin experiences CRUD route tests
 *
 * Covers:
 *   GET    /api/v1/experiences        — list, offset pagination; 401 unauth
 *   POST   /api/v1/experiences        — create; 201; 409 displayOrder collision; 401 unauth
 *   GET    /api/v1/experiences/:id    — single; 404 not found; 401 unauth
 *   PATCH  /api/v1/experiences/:id    — update; 200; 404; 401; cache invalidated
 *   DELETE /api/v1/experiences/:id    — hard delete; 204; 404; 401; cache invalidated
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { ValkeyClient } from '../lib/valkey.js';
import { createExperiencesRouter } from './experiences.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXP_ID = '550e8400-e29b-41d4-a716-446655440002';
const USER_ID = 'user-123';

const sampleExperience = {
  id: EXP_ID,
  company: 'ACME Corp',
  role: 'Software Engineer',
  summary: 'Led backend team',
  startedAt: '2023-01-01',
  endedAt: null,
  location: 'Lima, Peru',
  displayOrder: 1,
  createdAt: new Date('2023-01-01'),
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

  app.route('/api/v1/experiences', createExperiencesRouter(db, valkey));
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/v1/experiences
// ---------------------------------------------------------------------------

describe('GET /api/v1/experiences', () => {
  it('returns 200 with items and total', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const itemChain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([sampleExperience]),
    };
    const countChain = {
      from: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(itemChain as any)
      .mockReturnValueOnce(countChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/experiences');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total', 1);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request('/api/v1/experiences');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/experiences
// ---------------------------------------------------------------------------

describe('POST /api/v1/experiences', () => {
  it('creates an experience and returns 201; cache invalidated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // displayOrder uniqueness check
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no collision
    };
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([sampleExperience]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'ACME Corp',
        role: 'Software Engineer',
        startedAt: '2023-01-01',
        displayOrder: 1,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('id', EXP_ID);
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 409 on displayOrder collision', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleExperience]), // displayOrder exists
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'ACME Corp',
        role: 'Engineer',
        startedAt: '2023-01-01',
        displayOrder: 1,
      }),
    });

    expect(res.status).toBe(409);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 422 on invalid body (missing required fields)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey);

    const res = await app.request('/api/v1/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'ACME' }), // missing role, startedAt, displayOrder
    });

    expect(res.status).toBe(422);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);

    const res = await app.request('/api/v1/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'ACME',
        role: 'Engineer',
        startedAt: '2023-01-01',
        displayOrder: 1,
      }),
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

    // No displayOrder collision
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
    const res = await app.request('/api/v1/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'Acme',
        role: 'Engineer',
        startedAt: '2023-01-01',
        displayOrder: 99,
      }),
    });

    expect(res.status).toBe(500);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('PATCH — DB update throws: cache NOT invalidated (del not called)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Experience exists
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleExperience]),
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
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'New Corp' }),
    });

    expect(res.status).toBe(500);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('DELETE — DB delete throws: cache NOT invalidated (del not called)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Experience exists
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: EXP_ID }]),
    };
    // DB delete throws
    const deleteChain = {
      where: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.delete).mockReturnValue(deleteChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(500);
    expect(valkey.del).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/experiences/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/experiences/:id', () => {
  it('returns 200 with the experience', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleExperience]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(EXP_ID);
  });

  it('returns 404 when experience not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/experiences/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/experiences/:id', () => {
  it('updates an experience and returns 200; cache invalidated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const updated = { ...sampleExperience, company: 'New Corp' };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleExperience]),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updated]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'New Corp' }),
    });

    expect(res.status).toBe(200);
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 404 when experience not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'New Corp' }),
    });

    expect(res.status).toBe(404);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company: 'x' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/experiences/:id (HARD DELETE)
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/experiences/:id', () => {
  it('hard-deletes an experience and returns 204; cache invalidated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: EXP_ID }]),
    };
    const deleteChain = {
      where: vi.fn().mockResolvedValue([{ id: EXP_ID }]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.delete).mockReturnValue(deleteChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(valkey.del).toHaveBeenCalledWith('public:portfolio:v1');
  });

  it('returns 404 when experience not found', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(selectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(valkey.del).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const app = buildApp(db, valkey, false);
    const res = await app.request(`/api/v1/experiences/${EXP_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
