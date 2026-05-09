/**
 * Public blog routes — no auth required.
 *
 * Implements:
 *   GET /api/v1/public/blog            — list published posts (cursor pagination)
 *   GET /api/v1/public/blog/:slug      — single published post + compiled MDX HTML
 *
 * MDX compilation uses @jcsoftdev/mdx-runtime (cachedCompile / Valkey cache).
 * Compile failures return a safe fallback HTML string — NEVER a 500.
 */

import { zValidator } from '@hono/zod-validator';
import type { DbClient, Post } from '@jcsoftdev/db';
import { media, posts } from '@jcsoftdev/db';
import type { ValkeyClient as MdxValkeyClient } from '@jcsoftdev/mdx-runtime';
import { cachedCompile, mdxCacheKey } from '@jcsoftdev/mdx-runtime';
import { and, eq, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';
import { buildPublicMediaUrlWithBucket } from '../lib/media-url.js';
import type { ValkeyClient } from '../lib/valkey.js';
import { PublicBlogQuerySchema } from '../schemas/posts.js';

// ---------------------------------------------------------------------------
// MDX compile fallback
// ---------------------------------------------------------------------------

const MDX_ERROR_HTML = '<div class="mdx-error">Content failed to render.</div>';

/**
 * Adapt our ValkeyClient to the MdxValkeyClient interface.
 *
 * Our ValkeyClient: set(key, value, ttlSeconds?) → Promise<string | null>
 * MdxValkeyClient: set(key, value, 'EX', ttl) → Promise<'OK' | null>
 */
function toMdxValkey(valkey: ValkeyClient): MdxValkeyClient {
  return {
    get: (key: string) => valkey.get(key),
    set: async (key: string, value: string, _ex: 'EX', ttl: number): Promise<'OK' | null> => {
      await valkey.set(key, value, ttl);
      return 'OK';
    },
  };
}

async function compileMdxSafe(post: Post, valkey: ValkeyClient): Promise<string> {
  try {
    const key = mdxCacheKey(post.slug, post.updatedAt);

    // Check cache first (before delegating to cachedCompile)
    const cached = await valkey.get(key);
    if (cached) return cached;

    // Cache miss — delegate to cachedCompile which handles compile + cache.set
    const result = await cachedCompile({
      slug: post.slug,
      updated_at: post.updatedAt,
      source: post.content,
      valkey: toMdxValkey(valkey),
    });

    if (!result.ok) {
      return MDX_ERROR_HTML;
    }

    return result.html;
  } catch {
    return MDX_ERROR_HTML;
  }
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createPublicBlogRouter(
  db: DbClient,
  valkey: ValkeyClient,
  minioPublicBase?: string
) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // GET /api/v1/public/blog — cursor-paginated published posts
    // -------------------------------------------------------------------------
    .get('/', zValidator('query', PublicBlogQuerySchema), async (c) => {
      const { cursor: rawCursor, limit } = c.req.valid('query');

      // Decode cursor — returns null for missing/valid-null, 400 for invalid
      let cursorDate: Date | null = null;
      if (rawCursor !== undefined && rawCursor !== '') {
        cursorDate = decodeCursor(rawCursor);
        if (cursorDate === null) {
          return c.json(
            {
              error: 'Invalid cursor value. Please use the nextCursor from a previous response.',
            },
            400
          );
        }
      }

      // Fetch limit+1 to determine if there's a next page
      const fetchLimit = limit + 1;

      let items: Post[];

      if (cursorDate) {
        items = await db
          .select()
          .from(posts)
          .where(and(eq(posts.status, 'published'), lt(posts.createdAt, cursorDate)))
          .orderBy(sql`${posts.createdAt} DESC`)
          .limit(fetchLimit);
      } else {
        items = await db
          .select()
          .from(posts)
          .where(eq(posts.status, 'published'))
          .orderBy(sql`${posts.createdAt} DESC`)
          .limit(fetchLimit);
      }

      const hasNextPage = items.length > limit;
      const pageItems = hasNextPage ? items.slice(0, limit) : items;

      const lastItem = pageItems[pageItems.length - 1];
      const nextCursor = hasNextPage && lastItem ? encodeCursor(lastItem.createdAt) : null;

      return c.json({
        items: pageItems.map((post) => serializePublicPost(post)),
        nextCursor,
      });
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/public/blog/:slug — single published post + MDX HTML
    // -------------------------------------------------------------------------
    .get('/:slug', async (c) => {
      const slug = c.req.param('slug');

      const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);

      // 404 if not found OR if not published
      if (!post || post.status !== 'published') {
        return c.json({ error: 'Post not found' }, 404);
      }

      // Resolve hero image URL if post has a media attachment
      let heroImageUrl: string | null = null;
      if (post.heroMediaId && minioPublicBase) {
        const [mediaRow] = await db
          .select()
          .from(media)
          .where(eq(media.id, post.heroMediaId))
          .limit(1);
        if (mediaRow) {
          heroImageUrl = buildPublicMediaUrlWithBucket(
            minioPublicBase,
            mediaRow.bucket,
            mediaRow.objectKey
          );
        }
      }

      const html = await compileMdxSafe(post, valkey);

      return c.json({
        post: serializePublicPost(post, heroImageUrl),
        html,
      });
    });

  return router;
}

// ---------------------------------------------------------------------------
// Serializer — public view (no internal fields)
// ---------------------------------------------------------------------------

function serializePublicPost(post: Post, heroImageUrl: string | null = null) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    heroMediaId: post.heroMediaId,
    heroImageUrl,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}
