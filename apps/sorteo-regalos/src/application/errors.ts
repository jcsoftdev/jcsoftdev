export const ERROR_CODES = [
  'INVALID_INPUT',
  'ROOM_NOT_FOUND',
  'ROOM_CLOSED',
  'ROOM_FULL',
  'NAME_TAKEN',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'WRONG_CODE',
  'LOCKED',
  'ALREADY_DRAWN',
  'NOT_ENOUGH_PEOPLE',
  'DRAW_IMPOSSIBLE',
  'CANNOT_REMOVE',
  'NOT_DRAWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details: Readonly<Record<string, unknown>> = {}
  ) {
    super(code);
  }
}
