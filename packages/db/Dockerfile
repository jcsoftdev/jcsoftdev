# One-shot migrator + seeder image.
# Usage (via docker-compose.prod.yml profile):
#   docker compose --profile migrate run --rm migrator
#
# Runs drizzle migrations against DATABASE_DIRECT_URL, then seeds canonical data.
FROM node:24-alpine
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @jcsoftdev/db...

COPY packages/config ./packages/config
COPY packages/db ./packages/db

WORKDIR /repo/packages/db
CMD ["sh", "-c", "node_modules/.bin/tsx src/migrate.ts && node_modules/.bin/tsx src/seeds/index.ts"]
