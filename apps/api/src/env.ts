import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),

  // CORS
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),

  // Database
  DATABASE_URL: z.url(), // pgBouncer (port 6432) — app queries
  DATABASE_DIRECT_URL: z.url(), // direct Postgres (port 5432) — migrations only

  // Valkey (Redis-compatible) for sessions + MDX compile cache + rate limiting
  VALKEY_URL: z.url(),

  // better-auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  COOKIE_DOMAIN: z.string().optional(), // undefined in dev, '.jcsoftdev.com' in prod

  // Resend (transactional email — magic-link)
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.email(),

  // MinIO (S3-compatible object storage)
  MINIO_ENDPOINT: z.url(),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET_MEDIA: z.string().default('posts-media'),
  MINIO_PUBLIC_URL: z.url().optional(), // signed-GET host swap when MinIO is behind a proxy
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse and export the validated environment.
 *
 * Fail-fast at startup: if any required var is missing or invalid, exit
 * immediately with a descriptive error listing the offending keys.
 *
 * Tests that import `EnvSchema` directly bypass this block because Vitest
 * sets VITEST=true, so they can test the schema without triggering process.exit.
 */
function parseEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', z.treeifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

// Skip singleton parse when running under Vitest so tests can import EnvSchema
// without triggering process.exit (the test file calls safeParse directly).
export const env: Env = process.env.VITEST
  ? ({} as Env) // placeholder — tests never use `env`, only `EnvSchema`
  : parseEnv();
