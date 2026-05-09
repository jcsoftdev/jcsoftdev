# @jcsoftdev/db

Drizzle ORM schema, migrations, and client factory for the jcsoftdev monorepo.

## Overview

This package provides a Drizzle client pre-configured for **pgbouncer transaction-pooling mode**. All application code connects through pgbouncer — never directly to Postgres. The only exception is the migrations runner, which connects directly for schema changes.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | pgbouncer connection URL (port 6432) | `postgres://user:pass@localhost:6432/jcsoft` |
| `DATABASE_DIRECT_URL` | Direct Postgres URL (port 5432) — migrations only | `postgres://user:pass@localhost:5432/jcsoft` |

## pgbouncer Transaction-Mode Constraints

**CRITICAL — READ BEFORE WRITING QUERIES**

pgbouncer in transaction-pooling mode assigns a Postgres backend connection for each transaction, then immediately reclaims it. This means:

### What is NOT allowed

- **`SET` statements outside a transaction** — session variables don't persist because you may hit a different backend on the next query. Example of what BREAKS:
  ```sql
  SET search_path = myschema;  -- THIS IS LOST on next query
  SELECT * FROM my_table;      -- may run on a different backend
  ```

- **`LISTEN` / `NOTIFY`** — require a persistent connection to a single backend. Use a dedicated direct Postgres connection or a separate message broker (Valkey) for pub/sub.

- **Server-side prepared statements** — pgbouncer transaction mode does NOT support protocol-level prepared statements. This is why `prepare: false` is set in the client factory. Drizzle composes queries client-side, so this is fully transparent.

- **Advisory locks held across statements** — advisory locks are session-scoped; they evaporate when the backend connection is returned to the pool.

### What IS supported

- **`BEGIN ... COMMIT` transactions** — the backend connection is held for the full transaction duration. Session-scoped operations INSIDE a transaction work normally.
  ```ts
  await db.transaction(async (tx) => {
    // SET LOCAL here would work — you're inside a transaction
    // and the backend is held for its duration
    await tx.select()...
  });
  ```

- **All Drizzle ORM queries** — Drizzle's query builder generates standard SQL that works perfectly in transaction mode.

- **`pnpm db:migrate`** — uses `DATABASE_DIRECT_URL` to connect directly to Postgres, bypassing pgbouncer entirely.

### If you need session mode

If a future feature genuinely requires session-scoped state (e.g., `LISTEN/NOTIFY` for realtime), provision a **second pgbouncer pool** on a separate port (e.g., `6433`) in session mode with a lower connection limit. Expose it via a second client factory (e.g., `createSessionClient(url)`). Do NOT change the primary pool — it must stay in transaction mode for throughput.

## Usage

```ts
import { createClient } from '@jcsoftdev/db';

// In your app startup (apps/api):
const db = createClient(process.env.DATABASE_URL!);

// Query example:
const result = await db.select().from(schema.users).where(eq(schema.users.id, userId));
```

## Scripts

```bash
# Generate migration SQL from schema changes
pnpm db:generate

# Run pending migrations (connects directly to Postgres)
pnpm db:migrate

# Open Drizzle Studio (interactive DB browser)
pnpm db:studio
```

## Connection Pool Sizing

- pgbouncer `default_pool_size`: 20 per database
- pgbouncer `max_client_conn`: 1000
- Postgres `max_connections`: 100
- Drizzle client `max`: 10 per app instance

The multiplexing happens at pgbouncer — 10 app connections → up to 20 Postgres connections via pgbouncer → 100 Postgres `max_connections` total.
