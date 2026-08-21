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
# oven/bun:1-alpine ships a built-in non-root `bun` user (uid/gid 1000).
# --chown flips ownership of the copied tree so the runtime can read it as that user.
COPY --from=deps --chown=bun:bun /repo /repo
WORKDIR /repo/apps/api
USER bun
EXPOSE 3000
# Migrations + seed do NOT run here (H3 fix): the Pre-Deploy migrator
# (docker-compose.prod.yml `migrator` service, gated before deploy) is the
# ONLY migration mechanism. Running migrate/seed on every container start
# duplicated that gate and raced an unlocked drizzle migrator across replicas.
# See docs/dokploy.md §4.6/§8 for the full migration flow.
CMD ["bun", "run", "src/index.ts"]
