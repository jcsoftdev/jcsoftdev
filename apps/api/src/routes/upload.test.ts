/**
 * TDD RED — Upload routes tests
 *
 * Tests presign and finalize endpoints with mocked MinIO presigner and DB.
 */

import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { createMinioPresigner } from '../lib/minio.js';
import { createUploadRouter } from './upload.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-123';
const MEDIA_ID = '660e8400-e29b-41d4-a716-446655440000';

function mockSession(userId = USER_ID) {
  return { token: 'tok-abc', userId };
}

function mockUser(id = USER_ID) {
  return { id, email: 'admin@example.com' };
}

function buildApp(
  db: DbClient,
  presigner: ReturnType<typeof createMinioPresigner>,
  authenticated = true,
  userId = USER_ID
) {
  const app = new Hono();

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

  const router = createUploadRouter(db, presigner);
  app.route('/api/v1/upload', router);

  return app;
}

function createMockPresigner() {
  return {
    createPresignedPutUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://minio.example.com/presigned-put?sig=abc',
      objectKey: `posts/${USER_ID}/2026/05/uuid-photo.jpg`,
    }),
  } as unknown as ReturnType<typeof createMinioPresigner>;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/upload/presign', () => {
  it('returns 200 with uploadUrl and objectKey', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();
    const app = buildApp(db, presigner);

    const res = await app.request('/api/v1/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 500_000,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('uploadUrl');
    expect(body).toHaveProperty('objectKey');
    expect(typeof body.uploadUrl).toBe('string');
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();
    const app = buildApp(db, presigner, false);

    const res = await app.request('/api/v1/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 500_000,
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 422 for oversize file (>5MB)', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();
    const app = buildApp(db, presigner);

    const res = await app.request('/api/v1/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 6_000_000, // > 5MB
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/size/i);
  });

  it('returns 422 for disallowed content type', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();
    const app = buildApp(db, presigner);

    const res = await app.request('/api/v1/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100_000,
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/content.?type/i);
  });
});

describe('POST /api/v1/upload/finalize', () => {
  it('returns 201 with media row', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();

    const sampleMedia = {
      id: MEDIA_ID,
      objectKey: `posts/${USER_ID}/2026/05/uuid-photo.jpg`,
      bucket: 'posts-media',
      mimeType: 'image/jpeg',
      sizeBytes: 500_000, // number (bigint mode:'number')
      width: null,
      height: null,
      alt: null,
      uploadedBy: USER_ID,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([sampleMedia]),
    };

    vi.mocked(db.insert).mockReturnValue(mockInsertChain as any);

    const app = buildApp(db, presigner);

    const res = await app.request('/api/v1/upload/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: `posts/${USER_ID}/2026/05/uuid-photo.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 500_000,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('id', MEDIA_ID);
  });

  it('returns 401 when not authenticated', async () => {
    const db = createMockDb();
    const presigner = createMockPresigner();
    const app = buildApp(db, presigner, false);

    const res = await app.request('/api/v1/upload/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey: 'posts/user/2026/05/photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100_000,
      }),
    });

    expect(res.status).toBe(401);
  });
});
