import { AppError, type ErrorCode } from '../application/errors';

export const ADMIN_SECRET_HEADER = 'x-admin-secret';
export const DEVICE_TOKEN_HEADER = 'x-device-token';
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  WRONG_CODE: 403,
  LOCKED: 429,
  NAME_TAKEN: 409,
  ROOM_CLOSED: 409,
  ROOM_FULL: 409,
  ALREADY_DRAWN: 409,
  NOT_ENOUGH_PEOPLE: 422,
  DRAW_IMPOSSIBLE: 422,
  CANNOT_REMOVE: 409,
  NOT_DRAWN: 409,
};

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, init: { status?: number; headers?: HeadersInit } = {}) {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...NO_STORE, ...init.headers },
  });
}

export function respond(work: () => Promise<Response>): Promise<Response> {
  return work().catch((error: unknown) => {
    if (error instanceof AppError) {
      return json({ error: error.code, ...error.details }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error('Unhandled request error', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'INTERNAL' }, { status: 500 });
  });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const parsed: unknown = await request.json().catch(() => null);
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

export function deviceCookieName(roomId: string): string {
  return `sr_${roomId}`;
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

export function readDeviceToken(request: Request, roomId: string): string | null {
  return request.headers.get(DEVICE_TOKEN_HEADER) ?? readCookie(request, deviceCookieName(roomId));
}

export function readAdminSecret(request: Request): string | null {
  return request.headers.get(ADMIN_SECRET_HEADER);
}

export function deviceCookie(roomId: string, token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${deviceCookieName(roomId)}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export interface RoomRouteContext {
  readonly params: Promise<{ readonly roomId: string }>;
}

export interface ParticipantRouteContext {
  readonly params: Promise<{ readonly roomId: string; readonly participantId: string }>;
}
