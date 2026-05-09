/**
 * Admin projects CRUD routes — auth-guarded.
 *
 * Implements (design §5):
 *   GET    /api/v1/projects        — list (offset pagination)
 *   POST   /api/v1/projects        — create; sanitize description; invalidate cache
 *   GET    /api/v1/projects/:id    — single project
 *   PATCH  /api/v1/projects/:id    — partial update; sanitize description; invalidate cache
 *   DELETE /api/v1/projects/:id    — HARD DELETE (V1 — no soft-delete column); invalidate cache
 *
 * Cache invalidation (ADR-13):
 *   - On every successful mutation: `invalidatePortfolioCache(valkey)`
 *   - Cache delete happens AFTER the DB write succeeds
 *   - Failed writes do NOT invalidate cache
 *
 * pgBouncer: multi-table writes (if added in future) MUST use db.transaction().
 * V1 has no multi-table writes for projects — heroMediaId is a plain nullable FK.
 *
 * Hono chained registration is mandatory for AppType inference.
 */

import { zValidator } from '@hono/zod-validator';
import type { DbClient, Project } from '@jcsoftdev/db';
import { projects } from '@jcsoftdev/db';
import { count, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { z } from 'zod';
import { invalidatePortfolioCache } from '../lib/portfolio-cache.js';
import type { ValkeyClient } from '../lib/valkey.js';
import { requireAuth } from '../middleware/auth.js';
import {
  type CreateProjectInput,
  CreateProjectSchema,
  type ProjectListQuery,
  ProjectListQuerySchema,
  type UpdateProjectInput,
  UpdateProjectSchema,
} from '../schemas/portfolio.js';

// ---------------------------------------------------------------------------
// Validation helper — returns 422 instead of default 400
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
// Serializer
// ---------------------------------------------------------------------------

function serializeProject(project: Project) {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    summary: project.summary ?? null,
    description: project.description ?? null,
    repoUrl: project.repoUrl ?? null,
    liveUrl: project.liveUrl ?? null,
    featuredOrder: project.featuredOrder ?? null,
    startedAt: project.startedAt ?? null,
    endedAt: project.endedAt ?? null,
    heroMediaId: project.heroMediaId ?? null,
    createdAt: project.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createProjectsRouter(db: DbClient, valkey: ValkeyClient) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // GET /api/v1/projects — list (offset pagination)
    // -------------------------------------------------------------------------
    .get('/', requireAuth(), zv422('query', ProjectListQuerySchema), async (c) => {
      const { limit, offset } = c.req.valid('query') as ProjectListQuery;

      // Sequential queries (pgBouncer tx-mode safe — no Promise.all)
      const items = await db
        .select()
        .from(projects)
        .orderBy(sql`${projects.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const countResult = await db.select({ count: count() }).from(projects);
      const total = Number(countResult[0]?.count ?? 0);

      return c.json({ items: items.map(serializeProject), total });
    })

    // -------------------------------------------------------------------------
    // POST /api/v1/projects — create
    // -------------------------------------------------------------------------
    .post('/', requireAuth(), zv422('json', CreateProjectSchema), async (c) => {
      const body = c.req.valid('json') as CreateProjectInput;

      // Slug uniqueness check (citext handles case-insensitivity at DB level)
      const existing = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.slug, body.slug))
        .limit(1);

      if (existing.length > 0) {
        return c.json(
          { error: `Slug '${body.slug}' is already in use. Choose a different slug.` },
          409
        );
      }

      const result = await db
        .insert(projects)
        .values({
          slug: body.slug,
          name: body.name,
          summary: body.summary,
          description: body.description,
          repoUrl: body.repoUrl || null,
          liveUrl: body.liveUrl || null,
          featuredOrder: body.featuredOrder,
          startedAt: body.startedAt,
          endedAt: body.endedAt,
          heroMediaId: body.heroMediaId,
        })
        .returning();

      const created = result[0];
      if (!created) {
        return c.json({ error: 'Failed to create project' }, 500);
      }

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return c.json(serializeProject(created), 201);
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/projects/:id — single project
    // -------------------------------------------------------------------------
    .get('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      return c.json(serializeProject(project));
    })

    // -------------------------------------------------------------------------
    // PATCH /api/v1/projects/:id — partial update
    // -------------------------------------------------------------------------
    .patch('/:id', requireAuth(), zv422('json', UpdateProjectSchema), async (c) => {
      const id = c.req.param('id');
      const body = c.req.valid('json') as UpdateProjectInput;

      // Verify project exists
      const [current] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Build update payload — only include provided fields
      const updatePayload: Partial<typeof projects.$inferInsert> = {};

      if (body.slug !== undefined) updatePayload.slug = body.slug;
      if (body.name !== undefined) updatePayload.name = body.name;
      if (body.summary !== undefined) updatePayload.summary = body.summary ?? undefined;
      if (body.description !== undefined) updatePayload.description = body.description ?? undefined;
      if (body.repoUrl !== undefined) updatePayload.repoUrl = body.repoUrl ?? undefined;
      if (body.liveUrl !== undefined) updatePayload.liveUrl = body.liveUrl ?? undefined;
      if (body.featuredOrder !== undefined)
        updatePayload.featuredOrder = body.featuredOrder ?? undefined;
      if (body.startedAt !== undefined) updatePayload.startedAt = body.startedAt ?? undefined;
      if (body.endedAt !== undefined) updatePayload.endedAt = body.endedAt ?? undefined;
      if (body.heroMediaId !== undefined) updatePayload.heroMediaId = body.heroMediaId ?? undefined;

      const updateResult = await db
        .update(projects)
        .set(updatePayload)
        .where(eq(projects.id, id))
        .returning();

      const updated = updateResult[0];
      if (!updated) {
        return c.json({ error: 'Project not found after update' }, 404);
      }

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return c.json(serializeProject(updated));
    })

    // -------------------------------------------------------------------------
    // DELETE /api/v1/projects/:id — HARD DELETE (V1 — no soft-delete column)
    // -------------------------------------------------------------------------
    .delete('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      // Verify project exists
      const [current] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Hard delete — per design §5 (no archived semantics on projects in V1)
      await db.delete(projects).where(eq(projects.id, id));

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return new Response(null, { status: 204 });
    });

  return router;
}
