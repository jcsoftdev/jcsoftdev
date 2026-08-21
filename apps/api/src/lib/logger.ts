/**
 * Structured logger — tiny zero-dependency JSON console wrapper.
 *
 * Emits one JSON object per line to stdout/stderr so log aggregators
 * (Loki, CloudWatch, Dokploy) can parse them without a transport.
 *
 * A dedicated logging library (pino) would be preferable, but this keeps the
 * API free of an extra runtime dependency while still giving structured,
 * greppable, request-scoped logs.
 *
 * Usage:
 *   log.info('request.start', { requestId, method, path });
 *   log.error('unhandled', { requestId, err });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  const record: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
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

/**
 * Generate a short request-scoped id. Uses crypto.randomUUID when available
 * (Node 18+/Bun), falling back to a timestamp+random string.
 */
export function generateRequestId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
