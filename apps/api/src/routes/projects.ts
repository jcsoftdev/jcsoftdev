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

import type { DbClient, Project } from '@jcsoftdev/db';
import { projects } from '@jcsoftdev/db';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { invalidatePortfolioCache } from '../lib/portfolio-cache.js';
import { zv422 } from '../lib/validation.js';
import type { ValkeyClient } from '../lib/valkey.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import {
  type CreateProjectInput,
  CreateProjectSchema,
  type ProjectListQuery,
  ProjectListQuerySchema,
  type UpdateProjectInput,
  UpdateProjectSchema,
} from '../schemas/portfolio.js';

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
    .get('/', requireAuth(), requireAdmin(), zv422('query', ProjectListQuerySchema), async (c) => {
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
    .post('/', requireAuth(), requireAdmin(), zv422('json', CreateProjectSchema), async (c) => {
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
    .get('/:id', requireAuth(), requireAdmin(), async (c) => {
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
    .patch('/:id', requireAuth(), requireAdmin(), zv422('json', UpdateProjectSchema), async (c) => {
      const id = c.req.param('id');
      const body = c.req.valid('json') as UpdateProjectInput;

      // Verify project exists — also fetch slug so we can tell a no-op slug
      // update (same value) apart from a genuine change requiring a collision
      // check below.
      const [current] = await db
        .select({ id: projects.id, slug: projects.slug })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Slug uniqueness check — mirrors the POST pre-check so a collision on
      // update returns the same actionable 409 instead of a bare 500 from the
      // Postgres unique_violation (projects_slug_unique). Excludes the row
      // being updated so re-submitting the record's own current slug is not a
      // false conflict.
      //
      // NOTE: this is a read-then-write and is racy under concurrency — see
      // the matching note in posts.ts PATCH. We deliberately do NOT wrap it
      // in a transaction: pgBouncer runs in transaction pooling mode and this
      // codebase avoids nested transactions (see `transaction: false` in
      // lib/auth-config.ts). The DB unique constraint remains the last line
      // of defense.
      if (body.slug !== undefined && body.slug !== current.slug) {
        const collision = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.slug, body.slug), ne(projects.id, id)))
          .limit(1);

        if (collision.length > 0) {
          return c.json(
            { error: `Slug '${body.slug}' is already in use. Choose a different slug.` },
            409
          );
        }
      }

      // Build update payload — only include provided fields.
      //
      // An explicit `null` MUST reach Drizzle as `null` so the column is set to
      // NULL. Coercing it to `undefined` makes Drizzle omit the key from the SET
      // clause entirely, so the field silently keeps its old value — the admin
      // clears a field, gets a success response, and the old value reappears on
      // reload. UpdateProjectSchema marks these fields `.nullable()` precisely
      // so they can be cleared.
      const updatePayload: Partial<typeof projects.$inferInsert> = {};

      if (body.slug !== undefined) updatePayload.slug = body.slug;
      if (body.name !== undefined) updatePayload.name = body.name;
      if (body.summary !== undefined) updatePayload.summary = body.summary;
      if (body.description !== undefined) updatePayload.description = body.description;
      if (body.repoUrl !== undefined) updatePayload.repoUrl = body.repoUrl;
      if (body.liveUrl !== undefined) updatePayload.liveUrl = body.liveUrl;
      if (body.featuredOrder !== undefined) updatePayload.featuredOrder = body.featuredOrder;
      if (body.startedAt !== undefined) updatePayload.startedAt = body.startedAt;
      if (body.endedAt !== undefined) updatePayload.endedAt = body.endedAt;
      if (body.heroMediaId !== undefined) updatePayload.heroMediaId = body.heroMediaId;

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
    .delete('/:id', requireAuth(), requireAdmin(), async (c) => {
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
