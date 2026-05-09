/**
 * Posts CRUD routes — admin-only, auth-guarded.
 *
 * Implements:
 *   POST   /api/v1/posts        — create post (slug uniqueness, default status=draft)
 *   GET    /api/v1/posts        — list posts (offset pagination, status filter)
 *   GET    /api/v1/posts/:id    — single post for editor
 *   PATCH  /api/v1/posts/:id   — update post (status transition validated)
 *   DELETE /api/v1/posts/:id   — soft-archive (status → archived)
 *
 * Hono chained registration is used throughout so that AppType inference
 * flows correctly. All routes are returned as a single chained Hono instance.
 *
 * pgBouncer constraint: multi-table writes MUST use db.transaction().
 */

import { zValidator } from '@hono/zod-validator';
import type { DbClient, Post } from '@jcsoftdev/db';
import { posts } from '@jcsoftdev/db';
import { count, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  type CreatePostInput,
  CreatePostSchema,
  type PostListQuery,
  PostListQuerySchema,
  type UpdatePostInput,
  UpdatePostSchema,
} from '../schemas/posts.js';

// ---------------------------------------------------------------------------
// Validation helper — returns 422 instead of zValidator's default 400.
// Uses typed output so callers can access c.req.valid() with proper types.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: needed for zValidator hook generics
function zv422<S extends z.ZodTypeAny>(target: 'json' | 'query', schema: S) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return c.json(
        { error: firstIssue?.message ?? 'Validation failed', issues: result.error.issues },
        422
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Status transition table
//
// Per spec REQ-4 (inferred from scenario "archived→draft REJECTED"):
//   draft      → published  OK
//   published  → draft      OK
//   *          → archived   OK
//   archived   → draft      REJECTED
//   archived   → published  REJECTED (archived is a terminal state)
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: [], // terminal — no forward transitions
};

function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true; // no-op is always valid
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

// ---------------------------------------------------------------------------
// Router factory — returns a chained Hono instance
// ---------------------------------------------------------------------------

export function createPostsRouter(db: DbClient) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // POST /api/v1/posts — create post
    // -------------------------------------------------------------------------
    .post('/', requireAuth(), zv422('json', CreatePostSchema), async (c) => {
      const session = (c as any).get('auth_session') as { userId: string };
      // Cast is necessary because the 422-hook breaks Hono's inferred type for valid()
      const body = c.req.valid('json') as CreatePostInput;

      // Check slug uniqueness (citext handles case-insensitivity at DB level)
      const existing = await db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.slug, body.slug))
        .limit(1);

      if (existing.length > 0) {
        return c.json(
          { error: `Slug '${body.slug}' is already in use. Choose a different slug.` },
          409
        );
      }

      const result = await db
        .insert(posts)
        .values({
          title: body.title,
          slug: body.slug,
          content: body.content,
          excerpt: body.excerpt,
          status: body.status,
          userId: session.userId,
          heroMediaId: body.heroMediaId,
        })
        .returning();

      const created = result[0];
      if (!created) {
        return c.json({ error: 'Failed to create post' }, 500);
      }

      return c.json(serializePost(created), 201);
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/posts — list posts (admin, offset pagination)
    // -------------------------------------------------------------------------
    .get('/', requireAuth(), zv422('query', PostListQuerySchema), async (c) => {
      // Cast necessary because the 422-hook breaks Hono's type inference for valid()
      const { page, pageSize, status } = c.req.valid('query') as PostListQuery;
      const offset = (page - 1) * pageSize;

      // Build WHERE clause
      const whereClause = status ? eq(posts.status, status) : undefined;

      // Sequential queries (pgBouncer tx-mode safe)
      const items = whereClause
        ? await db
            .select()
            .from(posts)
            .where(whereClause)
            .orderBy(sql`${posts.createdAt} DESC`)
            .limit(pageSize)
            .offset(offset)
        : await db
            .select()
            .from(posts)
            .orderBy(sql`${posts.createdAt} DESC`)
            .limit(pageSize)
            .offset(offset);

      const countResult = whereClause
        ? await db.select({ count: count() }).from(posts).where(whereClause)
        : await db.select({ count: count() }).from(posts);

      const total = Number(countResult[0]?.count ?? 0);

      return c.json({
        items: items.map(serializePost),
        total,
        page,
        pageSize,
      });
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/posts/:id — single post for editor
    // -------------------------------------------------------------------------
    .get('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

      if (!post) {
        return c.json({ error: 'Post not found' }, 404);
      }

      return c.json(serializePost(post));
    })

    // -------------------------------------------------------------------------
    // PATCH /api/v1/posts/:id — update post
    // -------------------------------------------------------------------------
    .patch('/:id', requireAuth(), zv422('json', UpdatePostSchema), async (c) => {
      const id = c.req.param('id');
      // Cast necessary because the 422-hook breaks Hono's type inference for valid()
      const body = c.req.valid('json') as UpdatePostInput;

      // Fetch current post for transition validation
      const [current] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

      if (!current) {
        return c.json({ error: 'Post not found' }, 404);
      }

      // Validate status transition
      if (body.status !== undefined && body.status !== current.status) {
        if (!isValidTransition(current.status, body.status)) {
          return c.json(
            {
              error: `Invalid status transition: '${current.status}' → '${body.status}'. Archived posts cannot be unarchived.`,
            },
            422
          );
        }
      }

      // Build update payload — only include fields that were provided
      const updatePayload: Partial<typeof posts.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (body.title !== undefined) updatePayload.title = body.title;
      if (body.slug !== undefined) updatePayload.slug = body.slug;
      if (body.content !== undefined) updatePayload.content = body.content;
      if (body.excerpt !== undefined) updatePayload.excerpt = body.excerpt ?? undefined;
      if (body.heroMediaId !== undefined) updatePayload.heroMediaId = body.heroMediaId ?? undefined;
      if (body.status !== undefined) {
        updatePayload.status = body.status;
        // Set publishedAt when transitioning to published
        if (body.status === 'published' && current.status !== 'published') {
          updatePayload.publishedAt = new Date();
        }
      }

      const updateResult = await db
        .update(posts)
        .set(updatePayload)
        .where(eq(posts.id, id))
        .returning();

      const updated = updateResult[0];
      if (!updated) {
        return c.json({ error: 'Post not found after update' }, 404);
      }

      return c.json(serializePost(updated));
    })

    // -------------------------------------------------------------------------
    // DELETE /api/v1/posts/:id — soft-archive (sets status=archived)
    // -------------------------------------------------------------------------
    .delete('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      // Verify post exists
      const [current] = await db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Post not found' }, 404);
      }

      // Soft-archive: set status → 'archived' per spec (no hard delete)
      await db
        .update(posts)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(posts.id, id))
        .returning();

      return new Response(null, { status: 204 });
    });

  return router;
}

// ---------------------------------------------------------------------------
// Serializer — ensures dates are ISO strings (JSON-safe)
// ---------------------------------------------------------------------------

function serializePost(post: Post) {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
  };
}
