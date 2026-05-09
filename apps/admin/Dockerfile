# Stage 1: Install dependencies
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/admin...

# Stage 2: Build Vite app
FROM node:24-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY apps/admin ./apps/admin
WORKDIR /repo/apps/admin
RUN /repo/node_modules/.bin/vite build

# Stage 3: Caddy runtime serving static SPA
FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/admin/dist /usr/share/caddy
COPY apps/admin/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
