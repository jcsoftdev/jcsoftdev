# Stage 1: Install dependencies and build
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/animations/package.json packages/animations/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/web...
COPY packages/config ./packages/config
COPY packages/animations ./packages/animations
COPY packages/ui ./packages/ui
COPY packages/types ./packages/types
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
# Build-time env vars needed by Astro/Vite for PUBLIC_ variables
ARG PUBLIC_API_URL=https://api.jcsoftdev.com
ARG PUBLIC_PLAUSIBLE_HOST=https://analytics.jcsoftdev.com
ARG PLAUSIBLE_DOMAIN=jcsoftdev.com
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV PUBLIC_PLAUSIBLE_HOST=${PUBLIC_PLAUSIBLE_HOST}
ENV PLAUSIBLE_DOMAIN=${PLAUSIBLE_DOMAIN}
RUN pnpm run build

# Stage 2: Runtime
FROM node:24-alpine AS runtime
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/web
EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
CMD ["node", "./dist/server/entry.mjs"]
