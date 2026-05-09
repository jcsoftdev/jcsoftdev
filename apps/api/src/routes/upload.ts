/**
 * Upload routes — admin-only, auth-guarded.
 *
 * Implements:
 *   POST /api/v1/upload/presign   — generate presigned MinIO PUT URL
 *   POST /api/v1/upload/finalize  — insert media row after successful upload
 *
 * Flow (ADR-5 presigned PUT pattern):
 *   1. Admin → POST /presign { filename, contentType, sizeBytes }
 *   2. API validates → returns { uploadUrl, objectKey }
 *   3. Browser PUT → MinIO directly using presigned URL
 *   4. Admin → POST /finalize { objectKey, mimeType, sizeBytes }
 *   5. API inserts media row → returns Media
 */

import { zValidator } from '@hono/zod-validator';
import type { DbClient } from '@jcsoftdev/db';
import { media } from '@jcsoftdev/db';
import { Hono } from 'hono';
import type { createMinioPresigner } from '../lib/minio.js';
import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from '../lib/minio.js';
import { requireAuth } from '../middleware/auth.js';
import { FinalizeUploadSchema, PresignUploadSchema } from '../schemas/posts.js';

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createUploadRouter(
  db: DbClient,
  presigner: ReturnType<typeof createMinioPresigner>
) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // POST /api/v1/upload/presign
    // -------------------------------------------------------------------------
    .post('/presign', requireAuth(), async (c) => {
      const session = (c as any).get('auth_session') as { userId: string };

      // Parse body manually so we can give specific error messages
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
      }

      const parsed = PresignUploadSchema.safeParse(body);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return c.json({ error: firstIssue?.message ?? 'Invalid request' }, 422);
      }

      const { filename, contentType, sizeBytes } = parsed.data;

      // Validate size (belt-and-suspenders — schema already validates, but presigner also validates)
      if (sizeBytes > MAX_SIZE_BYTES) {
        return c.json(
          {
            error: `File size ${sizeBytes} bytes exceeds maximum allowed size of ${MAX_SIZE_BYTES} bytes (5 MB)`,
          },
          422
        );
      }

      // Validate content type
      if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
        return c.json(
          {
            error: `Content-Type '${contentType}' is not allowed. Accepted types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
          },
          422
        );
      }

      const result = await presigner.createPresignedPutUrl({
        userId: session.userId,
        filename,
        contentType,
        sizeBytes,
      });

      return c.json({
        uploadUrl: result.uploadUrl,
        objectKey: result.objectKey,
      });
    })

    // -------------------------------------------------------------------------
    // POST /api/v1/upload/finalize
    // -------------------------------------------------------------------------
    .post('/finalize', requireAuth(), zValidator('json', FinalizeUploadSchema), async (c) => {
      const session = (c as any).get('auth_session') as { userId: string };
      const body = c.req.valid('json');

      // The default Hono serve target is 'posts-media'. The bucket name is stored
      // in the media row for future flexibility (e.g., serving from a CDN bucket).
      // We infer it from the objectKey prefix or use the configured default.
      const bucket = 'posts-media';

      // pgBouncer constraint: single insert, no transaction needed (single table).
      const insertResult = await db
        .insert(media)
        .values({
          objectKey: body.objectKey,
          bucket,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes, // number (bigint mode:'number')
          width: body.width,
          height: body.height,
          alt: body.alt,
          uploadedBy: session.userId,
        })
        .returning();

      const inserted = insertResult[0];
      if (!inserted) {
        return c.json({ error: 'Failed to insert media record' }, 500);
      }

      return c.json(
        {
          ...inserted,
          createdAt: inserted.createdAt.toISOString(),
        },
        201
      );
    });

  return router;
}
