# Stage 1: Install dependencies
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/animations/package.json packages/animations/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/web...

# Stage 2: Build Astro app
FROM node:24-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY apps/web ./apps/web
# Copy source for workspace packages (needed for Astro build)
COPY packages/config ./packages/config
COPY packages/animations ./packages/animations
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
WORKDIR /repo/apps/web
RUN node_modules/.bin/astro build

# Stage 3: Runtime
FROM node:24-alpine AS runtime
WORKDIR /app
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/node_modules ./node_modules
EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
CMD ["node", "./dist/server/entry.mjs"]
