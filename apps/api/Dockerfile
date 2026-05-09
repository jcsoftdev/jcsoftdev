# Stage 1: Install dependencies with Node+pnpm
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/mdx-runtime/package.json packages/mdx-runtime/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/api...
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/mdx-runtime ./packages/mdx-runtime
COPY apps/api ./apps/api

# Stage 2: Runtime with Bun
FROM oven/bun:1-alpine AS runtime
WORKDIR /repo
COPY --from=deps /repo /repo
WORKDIR /repo/apps/api
EXPOSE 3000
# 1. Run DB migrations (idempotent, uses DATABASE_DIRECT_URL -> postgres:5432 direct)
# 2. Run seed (idempotent, ON CONFLICT DO NOTHING — inserts experiences + projects)
# 3. Start the API server
CMD ["sh", "-c", "cd /repo/packages/db && bun run src/migrate.ts && bun run src/seeds/index.ts && cd /repo/apps/api && bun run src/index.ts"]
