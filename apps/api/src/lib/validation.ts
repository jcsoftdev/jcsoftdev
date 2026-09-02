/**
 * Shared request-validation helpers.
 *
 * `zv422` wraps @hono/zod-validator so that validation failures return HTTP 422
 * (Unprocessable Entity) with a consistent JSON body, instead of zValidator's
 * default 400. Extracted here so posts/projects/experiences routes share one
 * definition rather than each redefining it verbatim.
 */

import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

/**
 * Validate `target` ('json' | 'query') against `schema`, returning 422 with the
 * first issue's message on failure. Typed output preserves c.req.valid() types.
 */
export function zv422<T extends 'json' | 'query', S extends z.ZodTypeAny>(target: T, schema: S) {
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
