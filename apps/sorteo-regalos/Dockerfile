FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY apps/sorteo-regalos/package.json apps/sorteo-regalos/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/sorteo-regalos...
COPY packages/config ./packages/config
COPY apps/sorteo-regalos ./apps/sorteo-regalos
WORKDIR /repo/apps/sorteo-regalos
RUN pnpm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3015 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/sorteo-regalos/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/sorteo-regalos/.next/static ./apps/sorteo-regalos/.next/static
COPY --from=build --chown=node:node /repo/apps/sorteo-regalos/migrations ./apps/sorteo-regalos/migrations
USER node
EXPOSE 3015
CMD ["node", "apps/sorteo-regalos/server.js"]
