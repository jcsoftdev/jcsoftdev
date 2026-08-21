import type { DbClient } from '@jcsoftdev/db';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { generateRequestId, log } from './lib/logger.js';
import type { createMinioPresigner } from './lib/minio.js';
import type { ValkeyClient } from './lib/valkey.js';
import { setAdminEmails } from './middleware/auth.js';
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
   * Admin allowlist — emails permitted to perform admin mutations (requireAdmin).
   * Empty/omitted → nobody is authorized (fail-closed). Wire from env.ADMIN_EMAILS.
   */
  adminEmails?: string[];
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
   */
  minioPublicBase?: string;
};

/** Max JSON/body size accepted globally (~1 MB). */
const MAX_BODY_BYTES = 1_048_576;

/** Extract a best-effort client IP for rate-limiting keys. */
function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  const cf = c.req.header('CF-Connecting-IP');
  if (cf) return cf;
  const xff = c.req.header('X-Forwarded-For');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  return c.req.header('X-Real-IP') ?? 'unknown';
}

/** Race a promise against a timeout — resolves false if it rejects or times out. */
async function pingWithTimeout(fn: () => Promise<unknown>, ms: number): Promise<boolean> {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
    return true;
  } catch {
    return false;
  }
}

// IMPORTANT: Routes are registered via chained .get()/.post()/.route() calls on
// a single Hono instance so that Hono's RPC type inference captures the full
// route tree. createApp ALWAYS returns ONE chained tree (no conditional return
// branches) — AppType = ReturnType<typeof createApp> is therefore a single type,
// not a union, so hc<AppType> can infer the schema (audit fix H1).
export function createApp(config: AppConfig) {
  const db = config.db as DbClient;
  const valkey = config.valkey as ValkeyClient;
  const presigner = config.presigner as ReturnType<typeof createMinioPresigner>;

  const authHandler = config.authHandler;
  const rateLimitValkey = config.valkey;

  const app = new Hono()
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
    // Request-scoped id — attached to context and surfaced in error logs
    .use('*', async (c, next) => {
      (c as unknown as { set(k: string, v: unknown): void }).set('request_id', generateRequestId());
      await next();
    })
    // Global body size limit (~1 MB) — reject oversized payloads early
    .use(
      '*',
      bodyLimit({
        maxSize: MAX_BODY_BYTES,
        onError: (c) => c.json({ error: 'Payload too large' }, 413),
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
    // Admin allowlist — read by requireAdmin() on mutating routes
    .use('*', async (c, next) => {
      setAdminEmails(c, config.adminEmails ?? []);
      await next();
    })
    .get('/health', (c) => {
      return c.json({ status: 'ok' });
    })
    // Readiness probe — pings Postgres + Valkey with a short timeout, 503 if down
    .get('/ready', async (c) => {
      const [dbOk, valkeyOk] = await Promise.all([
        db ? pingWithTimeout(() => db.execute(sql`select 1`), 1000) : Promise.resolve(false),
        rateLimitValkey
          ? pingWithTimeout(() => rateLimitValkey.get('__ready__'), 1000)
          : Promise.resolve(false),
      ]);

      const ready = dbOk && valkeyOk;
      return c.json(
        { status: ready ? 'ready' : 'unavailable', db: dbOk, valkey: valkeyOk },
        ready ? 200 : 503
      );
    })
    .get('/api/v1/hello', (c) => {
      return c.json({
        message: 'hello from jcsoftdev api',
        time: new Date().toISOString(),
      });
    })
    // -------------------------------------------------------------------------
    // Auth routes — /auth/* (better-auth handler passthrough). Always mounted so
    // AppType stays a single type. Rate limiting: magic-link send is limited
    // per-email (5/hr) AND per-IP (20/hr) to blunt address enumeration.
    // -------------------------------------------------------------------------
    .on(['GET', 'POST', 'DELETE'], '/auth/*', async (c) => {
      if (
        c.req.method === 'POST' &&
        c.req.path.includes('/auth/magic-link/send') &&
        rateLimitValkey
      ) {
        try {
          const rawBody = (await c.req.raw.clone().json()) as Record<string, unknown>;
          const email = rawBody.email as string | undefined;
          const { checkRateLimit } = await import('./lib/rate-limit.js');

          // Per-IP limit first — one IP may probe many emails
          const ip = clientIp(c);
          const ipResult = await checkRateLimit(rateLimitValkey, {
            key: `magic-link:ip:${ip}`,
            maxRequests: 20,
            windowSeconds: 3600,
          });
          if (!ipResult.allowed) {
            return c.json(
              { error: 'Too many magic-link requests from this network. Try again later.' },
              429
            );
          }

          if (email) {
            const emailResult = await checkRateLimit(rateLimitValkey, {
              key: `magic-link:${email}`,
              maxRequests: 5,
              windowSeconds: 3600,
            });
            if (!emailResult.allowed) {
              return c.json({ error: 'Too many magic-link requests. Try again in an hour.' }, 429);
            }
          }
        } catch (err) {
          // Rate-limit backend unavailable (e.g., Valkey down). Fail OPEN so
          // legitimate users are not blocked, but LOG it — silent pass-through
          // hides an outage and an enumeration window (audit fix H7).
          log.warn('magic-link.ratelimit_unavailable', {
            requestId: (c as unknown as { get(k: string): unknown }).get('request_id'),
            err,
          });
        }
      }

      return (
        authHandler?.(c.req.raw) ?? new Response('Auth handler not configured', { status: 503 })
      );
    })
    // -------------------------------------------------------------------------
    // Business routes — always registered (single route tree, audit fix H1).
    // Router factories reference db/valkey/presigner only inside handlers, so
    // registering them without deps (auth-only test apps) is safe.
    // -------------------------------------------------------------------------
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

  // Global error handler — structured log + generic 500 (audit fix H4). Preserve
  // HTTPExceptions (e.g. bodyLimit's 413) so their intended status is returned.
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    log.error('unhandled_error', {
      requestId: (c as unknown as { get(k: string): unknown }).get('request_id'),
      method: c.req.method,
      path: c.req.path,
      err,
    });
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
