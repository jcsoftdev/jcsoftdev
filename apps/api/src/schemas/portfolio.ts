/**
 * Zod 4 schemas for portfolio CRUD (admin) and public portfolio routes.
 *
 * All schemas are defined here and imported by route handlers.
 * The response shape is inferred by the route serializers — no separate
 * response schema is needed because we use TypeScript inference from
 * Drizzle's `$inferSelect` types.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Project schemas
// ---------------------------------------------------------------------------

export const CreateProjectSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .transform((s) => s.toLowerCase()),
  name: z.string().min(1, 'Name is required'),
  summary: z.string().min(1, 'Summary is required'),
  description: z.string().optional(),
  repoUrl: z.string().url().optional().or(z.literal('')).optional(),
  liveUrl: z.string().url().optional().or(z.literal('')).optional(),
  featuredOrder: z.number().int().min(0).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  heroMediaId: z.string().uuid('heroMediaId must be a valid UUID').optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  slug: z
    .string()
    .min(1)
    .transform((s) => s.toLowerCase())
    .optional(),
  name: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  repoUrl: z.string().url().nullable().optional(),
  liveUrl: z.string().url().nullable().optional(),
  featuredOrder: z.number().int().min(0).nullable().optional(),
  startedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  heroMediaId: z.string().uuid().nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/** Admin list query — offset pagination */
export const ProjectListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

// ---------------------------------------------------------------------------
// Experience schemas
// ---------------------------------------------------------------------------

export const CreateExperienceSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  summary: z.string().optional(),
  startedAt: z.string().min(1, 'startedAt is required'),
  endedAt: z.string().nullable().optional(),
  location: z.string().optional(),
  displayOrder: z.number().int().min(0, 'displayOrder must be a non-negative integer'),
});

export type CreateExperienceInput = z.infer<typeof CreateExperienceSchema>;

export const UpdateExperienceSchema = z.object({
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type UpdateExperienceInput = z.infer<typeof UpdateExperienceSchema>;

/** Admin list query — offset pagination (same shape as projects) */
export const ExperienceListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ExperienceListQuery = z.infer<typeof ExperienceListQuerySchema>;
