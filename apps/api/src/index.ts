import { createClient } from '@jcsoftdev/db';
import { serve } from 'bun';
import { Resend } from 'resend';
import { createApp } from './app.js';
import { env } from './env.js';
import { createAuthInstance } from './lib/auth-config.js';
import { sendMagicLink } from './lib/email.js';
import { createMinioPresigner } from './lib/minio.js';
import { createValkeyClient } from './lib/valkey.js';
import { authMiddleware } from './middleware/auth.js';

// ---------------------------------------------------------------------------
// Infrastructure clients
// ---------------------------------------------------------------------------

const valkey = createValkeyClient(env.VALKEY_URL);
const db = createClient(env.DATABASE_URL);
const resend = new Resend(env.RESEND_API_KEY);

const presigner = createMinioPresigner({
  endpoint: env.MINIO_ENDPOINT,
  region: env.MINIO_REGION,
  accessKeyId: env.MINIO_ACCESS_KEY,
  secretAccessKey: env.MINIO_SECRET_KEY,
  bucket: env.MINIO_BUCKET_MEDIA,
});

// ---------------------------------------------------------------------------
// Auth instance (better-auth + magic-link + Valkey secondaryStorage + Drizzle)
// ---------------------------------------------------------------------------

const auth = createAuthInstance({
  betterAuthSecret: env.BETTER_AUTH_SECRET,
  betterAuthUrl: env.BETTER_AUTH_URL,
  cookieDomain: env.COOKIE_DOMAIN,
  nodeEnv: env.NODE_ENV,
  corsOrigins: env.CORS_ORIGINS,
  resendFromEmail: env.RESEND_FROM_EMAIL,
  sendMagicLinkEmail: async ({ email, url }) => {
    await sendMagicLink({ email, url, fromEmail: env.RESEND_FROM_EMAIL }, resend as any);
  },
  valkeyClient: valkey,
  dbClient: db,
});

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = createApp({
  corsOrigins: env.CORS_ORIGINS,
  authHandler: auth.handler.bind(auth),
  authMiddlewareHandler: authMiddleware(auth),
  db,
  valkey,
  presigner,
  // Public base URL for hero images: MINIO_PUBLIC_URL if set, otherwise MINIO_ENDPOINT
  // Pattern: ${minioPublicBase}/${bucket}/${objectKey}
  minioPublicBase: env.MINIO_PUBLIC_URL ?? env.MINIO_ENDPOINT,
});

serve({
  port: env.PORT,
  fetch: app.fetch,
});
