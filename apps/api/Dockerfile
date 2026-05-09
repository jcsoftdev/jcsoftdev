# Stage 1: Install dependencies using pnpm + Node
FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/mdx-runtime/package.json packages/mdx-runtime/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/api...

# Stage 2: Compile with Bun
FROM oven/bun:1-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/mdx-runtime ./packages/mdx-runtime
COPY apps/api ./apps/api
WORKDIR /repo/apps/api
RUN bun build --compile --minify ./src/index.ts --outfile /api-bin

# Stage 3: Minimal runtime
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
COPY --from=build /api-bin /api
EXPOSE 3000
CMD ["/api"]
