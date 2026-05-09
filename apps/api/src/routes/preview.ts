/**
 * Preview route — Phase 6 carryover.
 *
 * POST /api/v1/preview
 *
 * Admin-only endpoint that compiles arbitrary MDX source and returns HTML.
 * No caching — each call compiles fresh (UX endpoint, not a production render path).
 * Used by the admin PostEditor to show a live compiled preview of the MDX content.
 *
 * Auth: requireAuth() — admin sessions only.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { compileMdx } from '../lib/mdx.js';
import { requireAuth } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const PreviewSchema = z.object({
  source: z.string().min(1, 'Source MDX content is required'),
});

// ---------------------------------------------------------------------------
// Fallback HTML for compile errors
// ---------------------------------------------------------------------------

const PREVIEW_ERROR_HTML =
  '<div class="mdx-error">Preview failed to render. Check your MDX syntax.</div>';

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createPreviewRouter() {
  return (
    new Hono()

      // POST /api/v1/preview
      .post('/', requireAuth(), async (c) => {
        // Parse body
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'Invalid JSON body' }, 400);
        }

        // Validate
        const parsed = PreviewSchema.safeParse(body);
        if (!parsed.success) {
          const firstIssue = parsed.error.issues[0];
          return c.json({ error: firstIssue?.message ?? 'Invalid request' }, 422);
        }

        const { source } = parsed.data;

        // Compile — never throw from the route handler
        let html: string;
        try {
          html = await compileMdx(source);
        } catch {
          html = PREVIEW_ERROR_HTML;
        }

        return c.json({ html });
      })
  );
}
