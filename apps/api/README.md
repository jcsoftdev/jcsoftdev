# @jcsoftdev/api

Hono REST + RPC API for the jcsoftdev platform. Runs on the Bun runtime.

---

## Environment Variables

All variables are validated at startup via `src/env.ts` (Zod 4). Missing or malformed values cause a non-zero exit with a descriptive error.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment: `development`, `test`, or `production` |
| `PORT` | Yes | — | HTTP server port (e.g. `3000`) |
| `CORS_ORIGINS` | Yes | — | Comma-separated list of allowed CORS origins |
| `DATABASE_URL` | Yes | — | pgBouncer connection URL (port 6432) — app queries |
| `DATABASE_DIRECT_URL` | Yes | — | Direct Postgres URL (port 5432) — migrations only |
| `VALKEY_URL` | Yes | — | Valkey connection URL (e.g. `redis://localhost:6379`) |
| `BETTER_AUTH_SECRET` | Yes | — | Secret key for better-auth (min 32 chars) |
| `BETTER_AUTH_URL` | Yes | — | Public URL of this API (e.g. `https://api.jcsoftdev.com`) |
| `COOKIE_DOMAIN` | No | — | Cookie domain for cross-subdomain auth. Omit in local dev. |
| `RESEND_API_KEY` | Yes | — | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | Yes | — | Sender email (must be a verified Resend domain) |
| `MINIO_ENDPOINT` | Yes | — | MinIO endpoint (e.g. `http://localhost:9000`) |
| `MINIO_REGION` | No | `us-east-1` | S3 region (MinIO ignores but SDK requires) |
| `MINIO_ACCESS_KEY` | Yes | — | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | — | MinIO secret key |
| `MINIO_BUCKET_MEDIA` | No | `posts-media` | MinIO bucket name for post media |
| `MINIO_PUBLIC_URL` | No | — | Public-facing MinIO URL (when behind a proxy) |

---

## Route Catalog

### Health

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/health` | None | `{ status: 'ok' }` |
| `GET` | `/api/v1/hello` | None | `{ message, time }` |

### Auth (`/auth/*`) — better-auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/magic-link/send` | None | Request magic-link (5/email/hour rate limit) |
| `GET` | `/auth/magic-link/verify` | None | Verify token → set session cookie |
| `GET` | `/auth/session` | Cookie | Get current session |
| `POST` | `/auth/sign-out` | Cookie | Sign out |

### Posts (admin — requires auth)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `GET` | `/api/v1/posts` | `?status=&limit=&offset=` | `{ items: Post[], total: number }` |
| `POST` | `/api/v1/posts` | `CreatePostBody` | `Post` |
| `GET` | `/api/v1/posts/:id` | — | `Post` |
| `PATCH` | `/api/v1/posts/:id` | `UpdatePostBody` | `Post` |
| `DELETE` | `/api/v1/posts/:id` | — | `204` |

Status transitions: `draft → published|archived`, `published → draft|archived`, `archived → terminal`.

### Media Upload (requires auth)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/v1/upload/presign` | `{ filename, contentType, sizeBytes }` | `{ uploadUrl, objectKey }` |
| `POST` | `/api/v1/upload/finalize` | `{ objectKey, mimeType, sizeBytes, width?, height?, alt? }` | `Media` |

Constraints: max 5 MB, allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.

### MDX Preview (requires auth)

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/v1/preview` | `{ source: string }` | `{ html: string }` |

### Public Blog (no auth)

| Method | Path | Query | Response |
|---|---|---|---|
| `GET` | `/api/v1/public/blog` | `?cursor=&limit=10` | `{ items: PublicPost[], nextCursor }` |
| `GET` | `/api/v1/public/blog/:slug` | — | `{ post: PublicPost, html: string }` |

`PublicPost` includes `heroImageUrl: string | null` — public MinIO URL constructed when `heroMediaId` is set.

### Public Portfolio (no auth)

Served from Valkey cache (`public:portfolio:v1`, TTL 300s). Cache miss falls through to Postgres. Cache invalidated on every admin write to projects or experiences.

| Method | Path | Query | Response |
|---|---|---|---|
| `GET` | `/api/v1/public/portfolio` | — | `{ projects: PublicProject[], experiences: PublicExperience[] }` |
| `GET` | `/api/v1/public/portfolio/projects` | — | `{ items: PublicProject[] }` |
| `GET` | `/api/v1/public/portfolio/experiences` | — | `{ items: PublicExperience[] }` |

`PublicProject` fields: `id`, `name`, `slug`, `summary`, `descriptionHtml` (sanitized HTML from markdown), `repoUrl`, `liveUrl`, `heroImageUrl`, `featuredOrder`, `startedAt`, `endedAt`, `createdAt`.

`PublicExperience` fields: `id`, `company`, `role`, `summary`, `location`, `displayOrder`, `startedAt`, `endedAt`, `createdAt`.

Sort: projects `featuredOrder ASC NULLS LAST, startedAt DESC`; experiences `displayOrder ASC NULLS LAST, startedAt DESC`.

### Projects admin (requires auth)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `GET` | `/api/v1/projects` | `?limit=&offset=` | `{ items: Project[], total: number }` |
| `POST` | `/api/v1/projects` | `CreateProjectBody` | `Project` (201) |
| `GET` | `/api/v1/projects/:id` | — | `Project` |
| `PATCH` | `/api/v1/projects/:id` | `UpdateProjectBody` (partial) | `Project` |
| `DELETE` | `/api/v1/projects/:id` | — | `204` (hard delete) |

Cache `public:portfolio:v1` is invalidated (DEL) on every POST, PATCH, and DELETE.

### Experiences admin (requires auth)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `GET` | `/api/v1/experiences` | `?limit=&offset=` | `{ items: Experience[], total: number }` |
| `POST` | `/api/v1/experiences` | `CreateExperienceBody` | `Experience` (201) |
| `GET` | `/api/v1/experiences/:id` | — | `Experience` |
| `PATCH` | `/api/v1/experiences/:id` | `UpdateExperienceBody` (partial) | `Experience` |
| `DELETE` | `/api/v1/experiences/:id` | — | `204` (hard delete) |

409 on `displayOrder` collision (unique constraint). Cache invalidated on every write.

---

## Development

```bash
# Start in hot-reload mode
pnpm --filter @jcsoftdev/api dev

# Run tests (270+ tests, no server needed)
pnpm --filter @jcsoftdev/api test

# Typecheck
pnpm --filter @jcsoftdev/api typecheck

# Lint
pnpm --filter @jcsoftdev/api lint

# Build production binary
pnpm --filter @jcsoftdev/api build
# Output: apps/api/dist/api (single self-contained binary via bun build --compile)
```

## Architecture Notes

- Routes registered as a **single chain** on `createApp` return value — required for Hono RPC type inference. Never use `app.use()` on intermediate variables.
- All multi-table writes use `db.transaction()` (pgBouncer transaction mode).
- `prepare: false` is set in the DB client — never remove (pgBouncer requirement).
- `AppType` is exported for `hc<AppType>` RPC usage in `apps/web` and `apps/admin`.

## RPC Type Export

```ts
import type { AppType } from '@jcsoftdev/api';
import { hc } from 'hono/client';

const client = hc<AppType>('http://localhost:3000');
```
