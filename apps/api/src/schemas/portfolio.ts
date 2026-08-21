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
// Length caps — defensive upper bounds so a request body cannot balloon
// unbounded (works alongside the global bodyLimit middleware).
// ---------------------------------------------------------------------------

/** Max summary length (short blurb). */
export const MAX_SUMMARY_LENGTH = 2_000;
/** Max description length (long-form project write-up). */
export const MAX_DESCRIPTION_LENGTH = 20_000;

// ---------------------------------------------------------------------------
// Project schemas
// ---------------------------------------------------------------------------

export const CreateProjectSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(300, 'Slug is too long')
    .transform((s) => s.toLowerCase()),
  name: z.string().min(1, 'Name is required').max(300, 'Name is too long'),
  summary: z.string().min(1, 'Summary is required').max(MAX_SUMMARY_LENGTH, 'Summary is too long'),
  description: z.string().max(MAX_DESCRIPTION_LENGTH, 'Description is too long').optional(),
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
  name: z.string().min(1).max(300, 'Name is too long').optional(),
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH, 'Summary is too long').optional(),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, 'Description is too long')
    .nullable()
    .optional(),
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
  company: z.string().min(1, 'Company is required').max(300, 'Company is too long'),
  role: z.string().min(1, 'Role is required').max(300, 'Role is too long'),
  summary: z.string().max(MAX_SUMMARY_LENGTH, 'Summary is too long').optional(),
  startedAt: z.string().min(1, 'startedAt is required'),
  endedAt: z.string().nullable().optional(),
  location: z.string().optional(),
  displayOrder: z.number().int().min(0, 'displayOrder must be a non-negative integer'),
});

export type CreateExperienceInput = z.infer<typeof CreateExperienceSchema>;

export const UpdateExperienceSchema = z.object({
  company: z.string().min(1).max(300, 'Company is too long').optional(),
  role: z.string().min(1).max(300, 'Role is too long').optional(),
  summary: z.string().max(MAX_SUMMARY_LENGTH, 'Summary is too long').nullable().optional(),
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
