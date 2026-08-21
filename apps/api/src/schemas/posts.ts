/**
 * Zod 4 request/response schemas for posts CRUD, upload, and public blog routes.
 *
 * All schemas are defined here and imported by route handlers.
 * Exported types allow hc<AppType> consumers to get end-to-end type safety.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const POST_STATUS_VALUES = ['draft', 'published', 'archived'] as const;
export type PostStatusValue = (typeof POST_STATUS_VALUES)[number];

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** 5 MB — validated BEFORE presigning to prevent abuse */
export const MAX_UPLOAD_SIZE_BYTES = 5_242_880;

// ---------------------------------------------------------------------------
// Length caps — defensive upper bounds so a single request body cannot balloon
// unbounded (works alongside the global bodyLimit middleware).
// ---------------------------------------------------------------------------

/** Max MDX/Markdown body size (~100k chars). */
export const MAX_CONTENT_LENGTH = 100_000;
/** Max excerpt/summary length. */
export const MAX_EXCERPT_LENGTH = 2_000;

// ---------------------------------------------------------------------------
// Posts CRUD schemas
// ---------------------------------------------------------------------------

export const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title is too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(300, 'Slug is too long')
    .transform((s) => s.toLowerCase()),
  content: z.string().min(1, 'Content is required').max(MAX_CONTENT_LENGTH, 'Content is too long'),
  excerpt: z.string().max(MAX_EXCERPT_LENGTH, 'Excerpt is too long').optional(),
  status: z.enum(POST_STATUS_VALUES).default('draft'),
  heroMediaId: z.string().uuid().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(300, 'Title is too long').optional(),
  slug: z
    .string()
    .min(1)
    .max(300, 'Slug is too long')
    .transform((s) => s.toLowerCase())
    .optional(),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH, 'Content is too long').optional(),
  excerpt: z.string().max(MAX_EXCERPT_LENGTH, 'Excerpt is too long').nullable().optional(),
  status: z.enum(POST_STATUS_VALUES).optional(),
  heroMediaId: z.string().uuid().nullable().optional(),
});

export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

export const PostListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(POST_STATUS_VALUES).optional(),
});

export type PostListQuery = z.infer<typeof PostListQuerySchema>;

// ---------------------------------------------------------------------------
// Public blog schemas
// ---------------------------------------------------------------------------

export const PublicBlogQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export type PublicBlogQuery = z.infer<typeof PublicBlogQuerySchema>;

// ---------------------------------------------------------------------------
// Upload schemas
// ---------------------------------------------------------------------------

export const PresignUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z
    .string()
    .refine(
      (ct): ct is (typeof ALLOWED_MIME_TYPES)[number] =>
        (ALLOWED_MIME_TYPES as readonly string[]).includes(ct),
      {
        message: `Content-Type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      }
    ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_BYTES, `File size must not exceed ${MAX_UPLOAD_SIZE_BYTES} bytes (5 MB)`),
});

export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;

export const FinalizeUploadSchema = z.object({
  objectKey: z.string().min(1, 'Object key is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
});

export type FinalizeUploadInput = z.infer<typeof FinalizeUploadSchema>;
