/**
 * TDD RED — Posts CRUD route tests
 *
 * Uses a mock DB so tests are fast (no Testcontainers).
 * All DB interactions go through injected dependency.
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createPostsRouter } from './posts.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSession(userId = 'user-123') {
  return {
    token: 'tok-abc',
    userId,
  };
}

function mockUser(id = 'user-123') {
  return { id, email: 'admin@example.com' };
}

/** Build a minimal Hono test app with session injected in context. */
function buildApp(db: DbClient, authenticated = true, userId = 'user-123') {
  const app = new Hono();

  // Inject session into context (mimics authMiddleware)
  app.use('*', async (c, next) => {
    if (authenticated) {
      (c as any).set('auth_session', mockSession(userId));
      (c as any).set('auth_user', mockUser(userId));
    } else {
      (c as any).set('auth_session', null);
      (c as any).set('auth_user', null);
    }
    await next();
  });

  const router = createPostsRouter(db);
  app.route('/api/v1/posts', router);

  return app;
}

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------

const POST_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-123';

const samplePost = {
  id: POST_ID,
  slug: 'hello-world',
  title: 'Hello World',
  excerpt: null,
  content: '# Hello',
  status: 'draft' as const,
  publishedAt: null,
  userId: USER_ID,
  heroMediaId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function createMockDb(
  overrides: Partial<{
    findPost: any;
    findPosts: any;
    createPost: any;
    updatePost: any;
    slugExists: any;
  }> = {}
): DbClient {
  // Minimal mock — only the methods our route handlers will call
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/posts', () => {
  it('creates a post and returns 201', async () => {
    const db = createMockDb();

    // Mock: slug check returns nothing (no collision)
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // no existing slug
    };
    // Mock: insert returns new post
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([samplePost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);
    vi.mocked(db.insert).mockReturnValue(mockInsertChain as any);

    const app = buildApp(db);
    const res = await app.request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hello World',
        slug: 'hello-world',
        content: '# Hello',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id', POST_ID);
    expect(body).toHaveProperty('status', 'draft');
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const app = buildApp(db, false);

    const res = await app.request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', slug: 'hello', content: 'body' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 409 on slug collision', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([samplePost]), // slug exists
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db);
    const res = await app.request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello World', slug: 'hello-world', content: 'body' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect((body as any).error).toMatch(/slug/i);
  });

  it('returns 422 on invalid body', async () => {
    const db = createMockDb();
    const app = buildApp(db);

    const res = await app.request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'hello' }), // missing title + content
    });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/posts', () => {
  it('returns 200 with items and total', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([samplePost]),
    };
    const mockCountChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(mockSelectChain as any)
      .mockReturnValueOnce(mockCountChain as any);

    const app = buildApp(db);
    const res = await app.request('/api/v1/posts?page=1&pageSize=10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty('total');
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const app = buildApp(db, false);
    const res = await app.request('/api/v1/posts');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/posts/:id', () => {
  it('returns 200 with the post', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([samplePost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(POST_ID);
  });

  it('returns 404 when post not found', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const app = buildApp(db, false);
    const res = await app.request(`/api/v1/posts/${POST_ID}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/posts/:id', () => {
  it('updates a post and returns 200', async () => {
    const db = createMockDb();
    const updatedPost = { ...samplePost, title: 'Updated Title' };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([samplePost]),
    };
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedPost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);
    vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.title).toBe('Updated Title');
  });

  it('returns 422 on invalid status transition (archived → draft)', async () => {
    const db = createMockDb();
    const archivedPost = { ...samplePost, status: 'archived' as const };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([archivedPost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/transition/i);
  });

  it('allows draft → published transition', async () => {
    const db = createMockDb();
    const publishedPost = { ...samplePost, status: 'published' as const };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([samplePost]), // draft
    };
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([publishedPost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);
    vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    });

    expect(res.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const app = buildApp(db, false);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/posts/:id (soft-archive)', () => {
  it('soft-archives (sets status=archived) and returns 204', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([samplePost]),
    };
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ ...samplePost, status: 'archived' }]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);
    vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('returns 404 when post not found', async () => {
    const db = createMockDb();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const app = buildApp(db, false);
    const res = await app.request(`/api/v1/posts/${POST_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
