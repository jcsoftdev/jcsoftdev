import type { DbClient } from '@jcsoftdev/db';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import type { createMinioPresigner } from './lib/minio.js';
import type { ValkeyClient } from './lib/valkey.js';
import { createExperiencesRouter } from './routes/experiences.js';
import { createPostsRouter } from './routes/posts.js';
import { createPreviewRouter } from './routes/preview.js';
import { createProjectsRouter } from './routes/projects.js';
import { createPublicBlogRouter } from './routes/public-blog.js';
import { createPublicPortfolioRouter } from './routes/public-portfolio.js';
import { createUploadRouter } from './routes/upload.js';

export type AppConfig = {
  corsOrigins: string[];
  /**
   * Optional auth handler — when provided, all requests to /auth/* are
   * forwarded to it using better-auth's Web-Fetch handler pattern.
   *
   * Mount pattern (design §4):
   *   app.on(['GET','POST','DELETE'], '/auth/*', (c) => auth.handler(c.req.raw))
   *
   * Phase 4: pass `authInstance.handler` from index.ts.
   * Phase 2 stub / tests that don't need auth: omit this field.
   */
  authHandler?: (request: Request) => Promise<Response>;
  /**
   * Auth middleware — attaches session/user to context before protected routes.
   * Phase 5+: pass `authMiddleware(authInstance)` from index.ts.
   */
  authMiddlewareHandler?: ReturnType<typeof import('./middleware/auth.js').authMiddleware>;
  /**
   * DB client — required for posts, upload, public blog routes.
   * Phase 5+: pass `createClient(env.DATABASE_URL)` from index.ts.
   */
  db?: DbClient;
  /**
   * Valkey client — required for MDX cache in public blog routes and rate limiting.
   */
  valkey?: ValkeyClient;
  /**
   * MinIO presigner — required for upload routes.
   */
  presigner?: ReturnType<typeof createMinioPresigner>;
  /**
   * MinIO public base URL — used to construct public hero image URLs for the
   * public blog routes. Falls back to MINIO_ENDPOINT if not provided.
   * Pattern: ${minioPublicBase}/${bucket}/${objectKey}
   */
  minioPublicBase?: string;
};

// IMPORTANT: Routes must be registered via chained .get()/.post() calls
// on the returned value — NOT imperatively on app.  Hono's RPC type inference
// requires the schema to flow through the return type of each chained call.
// AppType = ReturnType<typeof createApp> captures the full route tree for hc<AppType>.
export function createApp(config: AppConfig) {
  const base = new Hono()
    .use(
      '*',
      cors({
        origin: config.corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        exposeHeaders: ['Set-Cookie'],
      })
    )
    .use('*', async (c, next) => {
      if (c.req.header('CF-Connecting-IP')) {
        return next();
      }
      return compress()(c, next);
    })
    // Auth middleware — attach session/user to context on every request
    .use('*', async (c, next) => {
      if (config.authMiddlewareHandler) {
        return config.authMiddlewareHandler(c, next);
      }
      await next();
    })
    .get('/health', (c) => {
      return c.json({ status: 'ok' });
    })
    .get('/api/v1/hello', (c) => {
      return c.json({
        message: 'hello from jcsoftdev api',
        time: new Date().toISOString(),
      });
    });

  // ---------------------------------------------------------------------------
  // Auth routes — /auth/* (better-auth handler passthrough)
  // Mount pattern per design §4 — Hono Web-Fetch passthrough.
  //
  // Rate limiting: magic-link send requests are rate-limited per email
  // (5 requests/email/hour) using the Valkey-backed rate limiter from Phase 4.
  // ---------------------------------------------------------------------------
  const withAuth = config.authHandler
    ? base.on(['GET', 'POST', 'DELETE'], '/auth/*', async (c) => {
        // Rate limit magic-link send requests
        if (
          c.req.method === 'POST' &&
          c.req.path.includes('/auth/magic-link/send') &&
          config.valkey
        ) {
          try {
            const rawBody = (await c.req.raw.clone().json()) as Record<string, unknown>;
            const email = rawBody.email as string | undefined;
            if (email) {
              const { checkRateLimit } = await import('./lib/rate-limit.js');
              const result = await checkRateLimit(config.valkey, {
                key: `magic-link:${email}`,
                maxRequests: 5,
                windowSeconds: 3600,
              });
              if (!result.allowed) {
                return c.json(
                  { error: 'Too many magic-link requests. Try again in an hour.' },
                  429
                );
              }
            }
          } catch {
            // If rate limit check fails (e.g., Valkey unavailable), allow through
            // to avoid blocking legitimate users
          }
        }
        return (
          config.authHandler?.(c.req.raw) ??
          new Response('Auth handler not configured', { status: 503 })
        );
      })
    : base;

  // ---------------------------------------------------------------------------
  // API routes — all require DB + auth middleware
  // ---------------------------------------------------------------------------
  const db = config.db;
  const valkey = config.valkey;
  const presigner = config.presigner;

  if (db && valkey && presigner) {
    // All business routes chained on withAuth so AppType captures the full tree
    return withAuth
      .route('/api/v1/posts', createPostsRouter(db))
      .route('/api/v1/upload', createUploadRouter(db, presigner))
      .route('/api/v1/public/blog', createPublicBlogRouter(db, valkey, config.minioPublicBase))
      .route('/api/v1/preview', createPreviewRouter())
      .route('/api/v1/projects', createProjectsRouter(db, valkey))
      .route('/api/v1/experiences', createExperiencesRouter(db, valkey))
      .route(
        '/api/v1/public/portfolio',
        createPublicPortfolioRouter(db, valkey, config.minioPublicBase)
      );
  }

  // Partial app (tests that only need health/hello/auth) — no DB routes
  return withAuth;
}

export type AppType = ReturnType<typeof createApp>;
