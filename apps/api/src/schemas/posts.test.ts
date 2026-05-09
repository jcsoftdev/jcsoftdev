/**
 * TDD RED — Zod schemas for posts CRUD
 * These tests must fail before implementation exists.
 */
import { describe, expect, it } from 'vitest';
import {
  CreatePostSchema,
  FinalizeUploadSchema,
  PostListQuerySchema,
  PresignUploadSchema,
  PublicBlogQuerySchema,
  UpdatePostSchema,
} from './posts.js';

describe('CreatePostSchema', () => {
  it('accepts a valid draft post body', () => {
    const result = CreatePostSchema.safeParse({
      title: 'Hello World',
      slug: 'hello-world',
      content: '# Hello\n\nWorld',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft'); // default
    }
  });

  it('accepts explicit status', () => {
    const result = CreatePostSchema.safeParse({
      title: 'Hello',
      slug: 'hello',
      content: 'body',
      status: 'published',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = CreatePostSchema.safeParse({ slug: 'hello', content: 'body' });
    expect(result.success).toBe(false);
  });

  it('rejects missing content', () => {
    const result = CreatePostSchema.safeParse({ title: 'Hello', slug: 'hello' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = CreatePostSchema.safeParse({
      title: 'Hello',
      slug: 'hello',
      content: 'body',
      status: 'deleted',
    });
    expect(result.success).toBe(false);
  });

  it('lowercases slug', () => {
    const result = CreatePostSchema.safeParse({
      title: 'Hello',
      slug: 'Hello-World',
      content: 'body',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('hello-world');
    }
  });

  it('accepts optional excerpt and heroMediaId', () => {
    const result = CreatePostSchema.safeParse({
      title: 'Hello',
      slug: 'hello',
      content: 'body',
      excerpt: 'short',
      heroMediaId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdatePostSchema', () => {
  it('accepts partial updates', () => {
    const result = UpdatePostSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('accepts status-only update', () => {
    const result = UpdatePostSchema.safeParse({ status: 'published' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = UpdatePostSchema.safeParse({ status: 'deleted' });
    expect(result.success).toBe(false);
  });

  it('accepts empty object (no-op patch)', () => {
    const result = UpdatePostSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('PostListQuerySchema', () => {
  it('defaults page=1 pageSize=20', () => {
    const result = PostListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('accepts status filter', () => {
    const result = PostListQuerySchema.safeParse({ status: 'draft' });
    expect(result.success).toBe(true);
  });

  it('coerces string numbers', () => {
    const result = PostListQuerySchema.safeParse({ page: '2', pageSize: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(10);
    }
  });
});

describe('PublicBlogQuerySchema', () => {
  it('defaults limit=10', () => {
    const result = PublicBlogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('accepts cursor string', () => {
    const result = PublicBlogQuerySchema.safeParse({ cursor: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('coerces limit', () => {
    const result = PublicBlogQuerySchema.safeParse({ limit: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
    }
  });
});

describe('PresignUploadSchema', () => {
  it('accepts a valid presign request', () => {
    const result = PresignUploadSchema.safeParse({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 500000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects size exceeding 5MB', () => {
    const result = PresignUploadSchema.safeParse({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 6_000_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid content type', () => {
    const result = PresignUploadSchema.safeParse({
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe('FinalizeUploadSchema', () => {
  it('accepts valid finalize body', () => {
    const result = FinalizeUploadSchema.safeParse({
      objectKey: 'posts/user123/2026/05/uuid-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 500000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional width, height, alt', () => {
    const result = FinalizeUploadSchema.safeParse({
      objectKey: 'posts/user123/2026/05/uuid-photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 500000,
      width: 1920,
      height: 1080,
      alt: 'A photo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing objectKey', () => {
    const result = FinalizeUploadSchema.safeParse({ mimeType: 'image/jpeg', sizeBytes: 500 });
    expect(result.success).toBe(false);
  });
});
