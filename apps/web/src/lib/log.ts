/**
 * Structured server-side logger for the Astro SSR process.
 *
 * apps/web had no logging at all, which is why /rss.xml returning 500 and the
 * sitemap silently dropping every post URL both went unnoticed — the sitemap
 * even catches its own failure and returns 200, so nothing anywhere recorded
 * that it had degraded.
 *
 * Same one-JSON-object-per-line shape as apps/api's logger so both services
 * aggregate identically. Deliberately tiny and dependency-free.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      // postgres-js and undici put the real reason on `cause`. The API's logger
      // omitted it, which hid "unsupported startup parameter: statement_timeout"
      // behind a generic "Failed query" for the whole outage.
      cause: value.cause instanceof Error ? serializeError(value.cause) : value.cause,
    };
  }
  return value;
}

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  const record: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    service: 'web',
    msg,
  };

  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      record[key] = key === 'err' || key === 'error' ? serializeError(value) : value;
    }
  }

  const line = JSON.stringify(record);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

export const log: Logger = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
};
