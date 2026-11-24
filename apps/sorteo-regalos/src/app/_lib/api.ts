import type { ErrorCode } from '../../application/errors';

export type ApiErrorCode = ErrorCode | 'INTERNAL' | 'NETWORK';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly details: Readonly<Record<string, unknown>> = {}
  ) {
    super(code);
  }
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body === undefined ? null : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { error, ...details } = (payload ?? {}) as Record<string, unknown>;
    throw new ApiError(typeof error === 'string' ? (error as ApiErrorCode) : 'INTERNAL', details);
  }
  return payload as T;
}

export function hasCode(error: unknown, code: ApiErrorCode): boolean {
  return error instanceof ApiError && error.code === code;
}
