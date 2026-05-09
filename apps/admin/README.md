# @jcsoftdev/admin

Admin panel built with React 19, Vite 7, TanStack Router, and Tailwind v4.

## Development

```bash
# From repo root
pnpm --filter @jcsoftdev/admin dev

# Or directly
cd apps/admin && pnpm dev
```

App starts on `http://localhost:5173`.

## Architecture

- **Router**: TanStack Router with file-based routing + `autoCodeSplitting`
- **Auth**: Stub `getSession()` in `src/lib/auth.ts` — wire better-auth in core-platform phase
- **Auth guard**: `src/routes/_auth.tsx` layout — `beforeLoad` redirects to `/` if no session
- **Styling**: Tailwind v4 via `@tailwindcss/vite` plugin
- **RPC**: `src/lib/api.ts` with Hono client — `AppType` wired in Phase 6.2

## Routes

| Path | Description |
|---|---|
| `/` | Public landing page |
| `/dashboard` | Auth-guarded dashboard (redirects to `/` if no session) |
| `/posts` | Blog posts list (auth-guarded) |
| `/posts/new` | Create blog post — MDX editor + image upload (auth-guarded) |
| `/posts/:id/edit` | Edit / publish / archive blog post (auth-guarded) |
| `/projects` | Projects list with pagination and delete (auth-guarded) |
| `/projects/new` | Create project — form with markdown preview + hero image upload (auth-guarded) |
| `/projects/:id/edit` | Edit project (auth-guarded) |
| `/experiences` | Work experience list with pagination and delete (auth-guarded) |
| `/experiences/new` | Create experience (auth-guarded) |
| `/experiences/:id/edit` | Edit experience (auth-guarded) |

## Content Model

### Projects

Fields: `name`, `slug` (unique), `summary`, `description` (markdown), `repoUrl`, `liveUrl`, `featuredOrder`, `startedAt`, `endedAt`, `heroMediaId` (FK to media — uploaded via `ImageUploadWidget`).

Admin write operations (create/update/delete) invalidate the portfolio cache (`public:portfolio:v1`) automatically.

**Hard delete**: project deletion is permanent (V1). Associated media rows in MinIO are NOT deleted automatically — manual cleanup required for orphaned files.

### Experiences

Fields: `company`, `role`, `summary`, `location`, `displayOrder` (unique per V1), `startedAt`, `endedAt`.

Same cache invalidation as projects. Hard delete, no undo.

## Testing

```bash
pnpm --filter @jcsoftdev/admin test
```

## Build

```bash
pnpm --filter @jcsoftdev/admin build
# Output: apps/admin/dist/ (static SPA assets)
```

## Docker

Build from repo root:

```bash
docker build -f apps/admin/Dockerfile -t jcsoftdev-admin .
docker run -p 5173:80 jcsoftdev-admin
```

Caddy serves static files with SPA fallback (`try_files {path} /index.html`).

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL of the API server (build-time) |
