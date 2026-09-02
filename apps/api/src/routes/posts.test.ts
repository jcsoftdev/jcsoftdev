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
    // Admin allowlist — matches mockUser email so requireAdmin() passes
    (c as any).set('admin_emails', ['admin@example.com']);
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

  it('returns 403 for a valid session whose email is NOT in the admin allowlist', async () => {
    const db = createMockDb();
    const app = new Hono();

    // Valid session, but the user's email is not allowlisted (C1 authz fix)
    app.use('*', async (c, next) => {
      (c as any).set('admin_emails', ['owner@jcsoftdev.com']);
      (c as any).set('auth_session', mockSession());
      (c as any).set('auth_user', { id: 'user-123', email: 'intruder@evil.com' });
      await next();
    });
    app.route('/api/v1/posts', createPostsRouter(db));

    const res = await app.request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', slug: 'hello', content: '# body' }),
    });

    expect(res.status).toBe(403);
    // The DB must never be touched for an unauthorized write
    expect(db.insert).not.toHaveBeenCalled();
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

describe('POST /api/v1/posts — publishedAt on create', () => {
  function insertSpy(
    returned: Omit<typeof samplePost, 'status'> & { status: 'draft' | 'published' }
  ) {
    return {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([returned]),
    };
  }

  it('stamps publishedAt when the post is created directly as published', async () => {
    // Regression: only the PATCH transition set publishedAt, so a post created
    // as 'published' had publishedAt=null and the blog/RSS/JSON-LD fell back
    // to updatedAt — the post rendered with no real publish date.
    const db = createMockDb();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const insertChain = insertSpy({ ...samplePost, status: 'published' as const });
    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const res = await buildApp(db).request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Live',
        slug: 'live',
        content: '# live',
        status: 'published',
      }),
    });

    expect(res.status).toBe(201);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: expect.any(Date) })
    );
  });

  it('leaves publishedAt unset when the post is created as draft', async () => {
    const db = createMockDb();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const insertChain = insertSpy(samplePost);
    vi.mocked(db.select).mockReturnValue(selectChain as any);
    vi.mocked(db.insert).mockReturnValue(insertChain as any);

    const res = await buildApp(db).request('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Draft', slug: 'draft', content: '# d', status: 'draft' }),
    });

    expect(res.status).toBe(201);
    const values = vi.mocked(insertChain.values).mock.calls[0]?.[0] as { publishedAt?: unknown };
    expect(values.publishedAt).toBeUndefined();
  });
});

describe('PATCH /api/v1/posts/:id — slug collision', () => {
  function selectOnce(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
  }

  it('returns 409 when the new slug belongs to another post', async () => {
    // Regression: PATCH had no pre-check, so a slug collision surfaced as a
    // bare 500 from posts_slug_unique instead of the 409 POST already returns.
    const db = createMockDb();
    vi.mocked(db.select)
      .mockReturnValueOnce(selectOnce([samplePost]) as any) // load current row
      .mockReturnValueOnce(selectOnce([{ id: 'another-post-id' }]) as any); // collision

    const res = await buildApp(db).request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'taken-slug' }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/already in use/i);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('does not run the collision query when the slug is unchanged', async () => {
    const db = createMockDb();
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([samplePost]),
    };
    vi.mocked(db.select).mockReturnValue(selectOnce([samplePost]) as any);
    vi.mocked(db.update).mockReturnValue(updateChain as any);

    const res = await buildApp(db).request(`/api/v1/posts/${POST_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: samplePost.slug }),
    });

    expect(res.status).toBe(200);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
