/**
 * TDD RED → GREEN — Blog fetch helper tests
 *
 * Phase 7: Tests for blog-fetch.ts helper module.
 * Tests cursor parsing, hero image URL building, and 404 path for unknown/draft posts.
 *
 * The Astro pages import these helpers and delegate data fetching to them.
 * This makes the logic unit-testable without the Astro Container API.
 *
 * Hero image strategy (Phase 7 resolution):
 * The API public-blog route returns `heroMediaId` (a UUID, not a URL).
 * Signed GET URL generation is deferred — the API does not yet include a heroImageUrl field.
 * `buildHeroImageUrl` is a passthrough that accepts a URL string or null/undefined.
 * When the API includes signed URLs in the response, the helper will work unchanged.
 *
 * AppType note: AppType is a union (conditional return in createApp) so TypeScript
 * only infers routes in the common subset. Tests cast the mocked api to `any`
 * to access public blog paths — same pattern as admin/src/lib/api.ts.
 *
 * vi.mock hoisting note: factory functions cannot reference variables declared in
 * the module body (they are hoisted above all declarations). Use vi.fn() inline.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildHeroImageUrl,
  fetchBlogPost,
  fetchBlogPosts,
  parseCursorFromUrl,
} from './blog-fetch.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.mock is hoisted to the top — factory must not reference outer variables.
// We use vi.fn() inline and retrieve them via the mocked module in each test.
vi.mock('./api.js', () => ({
  api: {
    api: {
      v1: {
        public: {
          blog: {
            $get: vi.fn(),
            ':slug': {
              $get: vi.fn(),
            },
          },
        },
      },
    },
  },
}));

// Convenience helper to get typed mock fns from the hoisted mock
async function getMocks() {
  // biome-ignore lint/suspicious/noExplicitAny: AppType union — public routes not in inferred common subset
  const { api } = (await import('./api.js')) as any;
  return {
    blogListGet: api.api.v1.public.blog.$get as ReturnType<typeof vi.fn>,
    blogSlugGet: api.api.v1.public.blog[':slug'].$get as ReturnType<typeof vi.fn>,
  };
}

// ---------------------------------------------------------------------------
// parseCursorFromUrl
// ---------------------------------------------------------------------------

describe('parseCursorFromUrl', () => {
  it('returns null when no cursor param present', () => {
    const url = new URL('http://localhost:3000/blog');
    expect(parseCursorFromUrl(url)).toBeNull();
  });

  it('returns cursor string when present', () => {
    const url = new URL('http://localhost:3000/blog?cursor=abc123&limit=5');
    expect(parseCursorFromUrl(url)).toBe('abc123');
  });

  it('returns null for empty cursor string', () => {
    const url = new URL('http://localhost:3000/blog?cursor=');
    expect(parseCursorFromUrl(url)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildHeroImageUrl
// ---------------------------------------------------------------------------

describe('buildHeroImageUrl', () => {
  it('returns null when heroImageUrl is null', () => {
    expect(buildHeroImageUrl(null)).toBeNull();
  });

  it('returns null when heroImageUrl is undefined', () => {
    expect(buildHeroImageUrl(undefined)).toBeNull();
  });

  it('returns the url as-is when provided (public URL from API)', () => {
    const url = 'https://minio.example.com/posts-media/posts/user1/2026/01/uuid-img.jpg';
    expect(buildHeroImageUrl(url)).toBe(url);
  });
});

// ---------------------------------------------------------------------------
// fetchBlogPosts
// ---------------------------------------------------------------------------

describe('fetchBlogPosts', () => {
  it('fetches published posts and returns items + nextCursor', async () => {
    const { blogListGet } = await getMocks();
    blogListGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'post-1',
            slug: 'hello-world',
            title: 'Hello World',
            excerpt: 'Short excerpt',
            heroMediaId: null,
            publishedAt: '2026-01-15T00:00:00Z',
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        nextCursor: null,
      }),
    });

    const result = await fetchBlogPosts({ cursor: null, limit: 10 });
    expect(result.items).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: test — we know the item exists
    expect(result.items[0]!.slug).toBe('hello-world');
    expect(result.nextCursor).toBeNull();
  });

  it('passes cursor to API when provided', async () => {
    const { blogListGet } = await getMocks();
    blogListGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], nextCursor: null }),
    });

    await fetchBlogPosts({ cursor: 'abc123', limit: 5 });

    expect(blogListGet).toHaveBeenCalledWith({
      query: { cursor: 'abc123', limit: '5' },
    });
  });

  it('passes no cursor when cursor is null', async () => {
    const { blogListGet } = await getMocks();
    blogListGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], nextCursor: null }),
    });

    await fetchBlogPosts({ cursor: null, limit: 10 });

    expect(blogListGet).toHaveBeenCalledWith({
      query: { limit: '10' },
    });
  });

  it('throws when API returns non-ok response', async () => {
    const { blogListGet } = await getMocks();
    blogListGet.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchBlogPosts({ cursor: null, limit: 10 })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchBlogPost (single)
// ---------------------------------------------------------------------------

describe('fetchBlogPost', () => {
  it('returns post and html for a published post', async () => {
    const { blogSlugGet } = await getMocks();
    blogSlugGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        post: {
          id: 'post-1',
          slug: 'hello-world',
          title: 'Hello World',
          excerpt: 'Short excerpt',
          heroMediaId: null,
          heroImageUrl: null,
          publishedAt: '2026-01-15T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        html: '<h1>Hello World</h1>',
      }),
    });

    const result = await fetchBlogPost('hello-world');
    expect(result).not.toBeNull();
    expect(result?.post.slug).toBe('hello-world');
    expect(result?.html).toBe('<h1>Hello World</h1>');
  });

  it('passes heroImageUrl from API response directly (public URL, no client-side transform)', async () => {
    const { blogSlugGet } = await getMocks();
    const heroUrl = 'http://localhost:9000/posts-media/posts/user1/2026/01/uuid-img.jpg';
    blogSlugGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        post: {
          id: 'post-1',
          slug: 'hero-post',
          title: 'Hero Post',
          excerpt: null,
          heroMediaId: 'media-uuid-123',
          heroImageUrl: heroUrl,
          publishedAt: '2026-01-15T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        },
        html: '<h1>Hero Post</h1>',
      }),
    });

    const result = await fetchBlogPost('hero-post');
    expect(result).not.toBeNull();
    expect(result?.post.heroImageUrl).toBe(heroUrl);
  });

  it('returns null for 404 (unknown slug or draft)', async () => {
    const { blogSlugGet } = await getMocks();
    blogSlugGet.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchBlogPost('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for draft post (API returns 404 for drafts)', async () => {
    const { blogSlugGet } = await getMocks();
    blogSlugGet.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchBlogPost('secret-draft');
    expect(result).toBeNull();
  });

  it('throws on unexpected API error (non-404)', async () => {
    const { blogSlugGet } = await getMocks();
    blogSlugGet.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchBlogPost('hello-world')).rejects.toThrow();
  });
});
