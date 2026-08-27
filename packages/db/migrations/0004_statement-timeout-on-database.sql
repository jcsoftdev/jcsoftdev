-- Enforce a 15s statement timeout at the database level.
--
-- This previously lived in the application's connection options
-- (packages/db/src/client.ts, `connection: { statement_timeout: 15_000 }`).
-- postgres-js turns those into startup parameters, and pgbouncer in
-- transaction-pooling mode refuses any startup parameter it cannot track:
--
--   WARNING unsupported startup parameter: statement_timeout=15000
--   LOG     closing because: unsupported startup parameter (age=0s)
--
-- pgbouncer closed the socket mid-handshake, so every query failed and every
-- DB-backed route returned 500 — the public portfolio, the blog API, /rss.xml,
-- and the sitemap's post list all at once.
--
-- Setting it on the database is the pooling-safe equivalent: pgbouncer's server
-- connections inherit it, it applies to every client regardless of how they
-- connect, and there is no startup parameter for the pooler to reject.
--
-- Runs against DATABASE_DIRECT_URL (direct Postgres, session mode), so ALTER
-- DATABASE is permitted here even though it would not be through the pooler.
--
-- Note: ALTER DATABASE takes no parameter placeholders and the database name
-- differs per environment, so the name is interpolated via format()/quote_ident
-- from current_database() rather than hardcoded.
--
-- DEPLOY ORDER — the setting applies to NEW server connections only. pgbouncer
-- holds its existing ones open, so until they cycle `SHOW statement_timeout`
-- still reports 0 through the pooler. Verified locally: before restarting
-- pgbouncer the value read 0 and a 20s query ran to completion; after a restart
-- it read 15s and the same query was cancelled. Restart pgbouncer after this
-- migration, or accept that enforcement begins whenever connections recycle.

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET statement_timeout = %L',
    current_database(),
    '15s'
  );
END
$$;
