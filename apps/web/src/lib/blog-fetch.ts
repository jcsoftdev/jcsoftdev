/**
 * Blog fetch helpers — Phase 7 public blog SSR.
 *
 * Encapsulates all data-fetching logic for the public blog pages so that:
 * 1. Astro pages stay thin (just import + render)
 * 2. The logic is unit-testable in Vitest without the Astro Container API
 *
 * Hero image strategy (Phase 7 resolution):
 * Design §9 specifies signed GET URLs (1h TTL) returned by the API.
 * The Phase 5 public-blog route currently returns `heroMediaId` (UUID only).
 * `buildHeroImageUrl` is a passthrough: when the API adds a `heroImageUrl` field
 * to the response, this helper will work unchanged. For Phase 7, hero images
 * are not rendered when no URL is available.
 */

import { api } from './api.js';

// ---------------------------------------------------------------------------
// Types — mirror the API serializer output (serializePublicPost)
// ---------------------------------------------------------------------------

export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: string;
  publishedAt: string | null;
  heroMediaId: string | null;
  /** Signed/public URL for the hero image. Set by the API when heroMediaId is present. */
  heroImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogListResult {
  items: PublicPost[];
  nextCursor: string | null;
}

export interface BlogPostResult {
  post: PublicPost;
  html: string;
}

// ---------------------------------------------------------------------------
// parseCursorFromUrl
// ---------------------------------------------------------------------------

/**
 * Extract the cursor query param from a URL object.
 * Returns null when absent or empty.
 */
export function parseCursorFromUrl(url: URL): string | null {
  const cursor = url.searchParams.get('cursor');
  if (!cursor || cursor.trim() === '') return null;
  return cursor;
}

// ---------------------------------------------------------------------------
// buildHeroImageUrl
// ---------------------------------------------------------------------------

/**
 * Passthrough helper for hero image URLs.
 * Accepts a URL string (from a future API signed-URL field) or null/undefined.
 * Returns the URL as-is, or null.
 */
export function buildHeroImageUrl(heroImageUrl: string | null | undefined): string | null {
  if (!heroImageUrl) return null;
  return heroImageUrl;
}

// ---------------------------------------------------------------------------
// fetchBlogPosts — list
// ---------------------------------------------------------------------------

/**
 * Fetch the paginated list of published posts from the API.
 *
 * @param options.cursor - Opaque cursor from previous page, or null for first page
 * @param options.limit  - Max posts per page (default 10)
 */
export async function fetchBlogPosts({
  cursor,
  limit,
}: {
  cursor: string | null;
  limit: number;
}): Promise<BlogListResult> {
  // Build query — omit cursor key when null to avoid sending "cursor=null"
  const query: Record<string, string> = { limit: String(limit) };
  if (cursor) {
    query.cursor = cursor;
  }

  // biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast
  const res = await (api as any).api.v1.public.blog.$get({ query });

  if (!res.ok) {
    throw new Error(`Failed to fetch blog posts: HTTP ${res.status}`);
  }

  const data = (await res.json()) as BlogListResult;
  return data;
}

// ---------------------------------------------------------------------------
// fetchBlogPost — single post by slug
// ---------------------------------------------------------------------------

/**
 * Fetch a single published post by slug from the API.
 *
 * Returns null when:
 *  - The slug does not exist (404)
 *  - The post is not published (API returns 404 for drafts and archived)
 *
 * Throws for unexpected errors (5xx).
 */
export async function fetchBlogPost(slug: string): Promise<BlogPostResult | null> {
  // biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast
  const res = await (api as any).api.v1.public.blog[':slug'].$get({
    param: { slug },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch blog post "${slug}": HTTP ${res.status}`);
  }

  const data = (await res.json()) as BlogPostResult;
  return data;
}
