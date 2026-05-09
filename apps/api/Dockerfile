# Stage 1: Build with Bun
FROM oven/bun:1-alpine AS build
WORKDIR /repo
# Copy workspace configuration
COPY package.json pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/mdx-runtime/package.json packages/mdx-runtime/
COPY apps/api/package.json apps/api/
# Install all dependencies with bun (reads pnpm-workspace.yaml for workspace resolution)
RUN bun install
# Copy source code for all required packages
COPY packages/config ./packages/config
COPY packages/db ./packages/db
COPY packages/mdx-runtime ./packages/mdx-runtime
COPY apps/api ./apps/api
# Build the API binary
WORKDIR /repo/apps/api
RUN bun build --compile --minify ./src/index.ts --outfile /api-bin

# Stage 2: Minimal runtime
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
COPY --from=build /api-bin /api
EXPOSE 3000
CMD ["/api"]
