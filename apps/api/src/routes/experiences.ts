/**
 * Admin experiences CRUD routes — auth-guarded.
 *
 * Implements (design §5):
 *   GET    /api/v1/experiences        — list (offset pagination)
 *   POST   /api/v1/experiences        — create; invalidate cache
 *   GET    /api/v1/experiences/:id    — single experience
 *   PATCH  /api/v1/experiences/:id    — partial update; invalidate cache
 *   DELETE /api/v1/experiences/:id    — HARD DELETE (V1); invalidate cache
 *
 * displayOrder collision: returns 409 (no auto-reorder — V1 UX per spec REQ-EXP-2).
 *
 * pgBouncer: no multi-table writes in V1. If added later, wrap in db.transaction().
 * Hono chained registration mandatory for AppType inference.
 */

import { zValidator } from '@hono/zod-validator';
import type { DbClient, Experience } from '@jcsoftdev/db';
import { experiences } from '@jcsoftdev/db';
import { count, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { z } from 'zod';
import { invalidatePortfolioCache } from '../lib/portfolio-cache.js';
import type { ValkeyClient } from '../lib/valkey.js';
import { requireAuth } from '../middleware/auth.js';
import {
  type CreateExperienceInput,
  CreateExperienceSchema,
  type ExperienceListQuery,
  ExperienceListQuerySchema,
  type UpdateExperienceInput,
  UpdateExperienceSchema,
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

function serializeExperience(experience: Experience) {
  return {
    id: experience.id,
    company: experience.company,
    role: experience.role,
    summary: experience.summary ?? null,
    startedAt: experience.startedAt,
    endedAt: experience.endedAt ?? null,
    location: experience.location ?? null,
    displayOrder: experience.displayOrder ?? null,
    createdAt: experience.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createExperiencesRouter(db: DbClient, valkey: ValkeyClient) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // GET /api/v1/experiences — list (offset pagination)
    // -------------------------------------------------------------------------
    .get('/', requireAuth(), zv422('query', ExperienceListQuerySchema), async (c) => {
      const { limit, offset } = c.req.valid('query') as ExperienceListQuery;

      // Sequential queries (pgBouncer tx-mode safe)
      const items = await db
        .select()
        .from(experiences)
        .orderBy(sql`${experiences.displayOrder} ASC NULLS LAST`)
        .limit(limit)
        .offset(offset);

      const countResult = await db.select({ count: count() }).from(experiences);
      const total = Number(countResult[0]?.count ?? 0);

      return c.json({ items: items.map(serializeExperience), total });
    })

    // -------------------------------------------------------------------------
    // POST /api/v1/experiences — create
    // -------------------------------------------------------------------------
    .post('/', requireAuth(), zv422('json', CreateExperienceSchema), async (c) => {
      const body = c.req.valid('json') as CreateExperienceInput;

      // displayOrder uniqueness check (unique constraint in schema — guard here for 409)
      const existing = await db
        .select({ id: experiences.id })
        .from(experiences)
        .where(eq(experiences.displayOrder, body.displayOrder))
        .limit(1);

      if (existing.length > 0) {
        return c.json(
          {
            error: `displayOrder ${body.displayOrder} is already in use. Choose a different value.`,
          },
          409
        );
      }

      const result = await db
        .insert(experiences)
        .values({
          company: body.company,
          role: body.role,
          summary: body.summary,
          startedAt: body.startedAt,
          endedAt: body.endedAt ?? undefined,
          location: body.location,
          displayOrder: body.displayOrder,
        })
        .returning();

      const created = result[0];
      if (!created) {
        return c.json({ error: 'Failed to create experience' }, 500);
      }

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return c.json(serializeExperience(created), 201);
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/experiences/:id — single experience
    // -------------------------------------------------------------------------
    .get('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      const [experience] = await db
        .select()
        .from(experiences)
        .where(eq(experiences.id, id))
        .limit(1);

      if (!experience) {
        return c.json({ error: 'Experience not found' }, 404);
      }

      return c.json(serializeExperience(experience));
    })

    // -------------------------------------------------------------------------
    // PATCH /api/v1/experiences/:id — partial update
    // -------------------------------------------------------------------------
    .patch('/:id', requireAuth(), zv422('json', UpdateExperienceSchema), async (c) => {
      const id = c.req.param('id');
      const body = c.req.valid('json') as UpdateExperienceInput;

      // Verify experience exists
      const [current] = await db
        .select({ id: experiences.id })
        .from(experiences)
        .where(eq(experiences.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Experience not found' }, 404);
      }

      // Build update payload
      const updatePayload: Partial<typeof experiences.$inferInsert> = {};

      if (body.company !== undefined) updatePayload.company = body.company;
      if (body.role !== undefined) updatePayload.role = body.role;
      if (body.summary !== undefined) updatePayload.summary = body.summary ?? undefined;
      if (body.startedAt !== undefined) updatePayload.startedAt = body.startedAt;
      if (body.endedAt !== undefined) updatePayload.endedAt = body.endedAt ?? undefined;
      if (body.location !== undefined) updatePayload.location = body.location ?? undefined;
      if (body.displayOrder !== undefined) updatePayload.displayOrder = body.displayOrder;

      const updateResult = await db
        .update(experiences)
        .set(updatePayload)
        .where(eq(experiences.id, id))
        .returning();

      const updated = updateResult[0];
      if (!updated) {
        return c.json({ error: 'Experience not found after update' }, 404);
      }

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return c.json(serializeExperience(updated));
    })

    // -------------------------------------------------------------------------
    // DELETE /api/v1/experiences/:id — HARD DELETE (V1)
    // -------------------------------------------------------------------------
    .delete('/:id', requireAuth(), async (c) => {
      const id = c.req.param('id');

      // Verify experience exists
      const [current] = await db
        .select({ id: experiences.id })
        .from(experiences)
        .where(eq(experiences.id, id))
        .limit(1);

      if (!current) {
        return c.json({ error: 'Experience not found' }, 404);
      }

      // Hard delete
      await db.delete(experiences).where(eq(experiences.id, id));

      // Invalidate cache AFTER successful DB write
      await invalidatePortfolioCache(valkey);

      return new Response(null, { status: 204 });
    });

  return router;
}
