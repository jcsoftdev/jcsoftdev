/**
 * TDD RED — Public blog routes tests
 *
 * Tests cursor pagination, MDX compile, auth exclusion, and draft visibility.
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { ValkeyClient } from '../lib/valkey.js';
import { createPublicBlogRouter } from './public-blog.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const POST_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-123';

function makePublishedPost(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    slug: 'hello-world',
    title: 'Hello World',
    excerpt: 'Short excerpt',
    content: '# Hello\n\nWorld',
    status: 'published' as const,
    publishedAt: new Date('2026-01-15T00:00:00Z'),
    userId: USER_ID,
    heroMediaId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createMockDb(overrides: Record<string, any> = {}): DbClient {
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

function createMockValkey(): ValkeyClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

function buildApp(db: DbClient, valkey: ValkeyClient, minioPublicBase?: string) {
  const app = new Hono();
  const router = createPublicBlogRouter(db, valkey, minioPublicBase);
  app.route('/api/v1/public/blog', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/blog', () => {
  it('returns 200 with items and nextCursor', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const posts = [makePublishedPost()];
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(posts),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('returns empty list when no published posts exist', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  it('returns nextCursor=null when result count equals limit (exact boundary)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // limit=10, returns exactly 10 posts → nextCursor depends on fetch limit+1 pattern
    // We fetch limit+1 to determine if there's a next page
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePublishedPost({ id: `id-${i}`, slug: `post-${i}` })
    );

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(posts), // exactly 10, no extra → null cursor
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog?limit=10');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // When we got exactly 'limit' items (not limit+1), there's no next page
    expect(body.nextCursor).toBeNull();
  });

  it('returns 400 on malformed cursor', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog?cursor=!!!invalid!!!');
    expect(res.status).toBe(400);
  });

  it('does not require authentication', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    // No auth cookie — should still return 200
    const res = await app.request('/api/v1/public/blog');
    expect(res.status).toBe(200);
  });

  it('includes heroImageUrl field (null) in list items', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePublishedPost({ heroMediaId: null })]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items[0]).toHaveProperty('heroImageUrl');
    expect(body.items[0].heroImageUrl).toBeNull();
  });
});

describe('GET /api/v1/public/blog/:slug', () => {
  it('returns 200 with post and compiled html', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePublishedPost()]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('post');
    expect(body).toHaveProperty('html');
    expect(typeof body.html).toBe('string');
  });

  it('returns 404 for unknown slug', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 for draft post (not visible publicly)', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const draftPost = makePublishedPost({ status: 'draft' });
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([draftPost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    // Draft found but not published → 404
    expect(res.status).toBe(404);
  });

  it('returns html from valkey cache on cache hit', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();
    const cachedHtml = '<h1>Cached Hello</h1>';

    // Cache hit — valkey.get returns cached HTML
    vi.mocked(valkey.get).mockResolvedValueOnce(cachedHtml);

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePublishedPost()]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Cached HTML returned without recompile
    expect(body.html).toBe(cachedHtml);
  });

  it('returns safe error html on compile failure', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Malformed MDX — compile will fail
    const brokenPost = makePublishedPost({ content: '<div unclosed' });
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([brokenPost]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    // Should still return 200 with a fallback error html string
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.html).toBe('string');
    expect(body.html.length).toBeGreaterThan(0);
  });

  it('does not require authentication', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePublishedPost()]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    expect(res.status).toBe(200);
  });

  it('returns heroImageUrl as null when post has no hero media', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([makePublishedPost({ heroMediaId: null })]),
    };

    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const app = buildApp(db, valkey);
    const res = await app.request('/api/v1/public/blog/hello-world');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.post).toHaveProperty('heroImageUrl');
    expect(body.post.heroImageUrl).toBeNull();
  });

  it('returns heroImageUrl (public URL) when post has a hero media', async () => {
    const db = createMockDb();
    const valkey = createMockValkey();

    // Post has a heroMediaId and the media row will be fetched
    const heroMediaId = 'media-uuid-123';
    const postWithHero = makePublishedPost({ heroMediaId });

    // Two select calls: first for the post, second for the media row
    const mediaRow = {
      id: heroMediaId,
      objectKey: 'posts/user-123/2026/01/uuid-img.jpg',
      bucket: 'posts-media',
      mimeType: 'image/jpeg',
      sizeBytes: 204800,
      uploadedBy: USER_ID,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const postSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([postWithHero]),
    };
    const mediaSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mediaRow]),
    };

    vi.mocked(db.select)
      .mockReturnValueOnce(postSelectChain as any)
      .mockReturnValueOnce(mediaSelectChain as any);

    const app = buildApp(db, valkey, 'http://localhost:9000');
    const res = await app.request('/api/v1/public/blog/hello-world');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.post).toHaveProperty('heroImageUrl');
    // Public URL pattern: ${MINIO_PUBLIC_URL}/${bucket}/${objectKey}
    expect(typeof body.post.heroImageUrl).toBe('string');
    expect(body.post.heroImageUrl).toContain(mediaRow.objectKey);
  });
});
