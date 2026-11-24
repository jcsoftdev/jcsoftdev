import { ApiError, type ApiErrorCode } from './api';

type Details = Readonly<Record<string, unknown>>;

const timeFormat = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

function untilText(details: Details): string {
  const until = typeof details.until === 'string' ? new Date(details.until) : null;
  return until ? timeFormat.format(until) : 'más tarde';
}

function namesText(details: Details): string {
  return Array.isArray(details.blocked) ? details.blocked.join(', ') : '';
}

const MESSAGES: Readonly<Record<ApiErrorCode, (details: Details) => string>> = {
  INVALID_INPUT: () => 'Revisa los datos e inténtalo de nuevo.',
  ROOM_NOT_FOUND: () => 'Esta sala no existe o ya venció.',
  ROOM_CLOSED: () => 'El sorteo ya se hizo y no se aceptan más personas.',
  ROOM_FULL: () => 'La sala llegó al máximo de 50 personas.',
  NAME_TAKEN: () => 'Ese nombre ya está en la sala. Si eres tú, entra con «Ya me registré».',
  UNAUTHORIZED: () => 'No tienes acceso desde este dispositivo.',
  NOT_FOUND: () => 'No encontramos a esa persona.',
  WRONG_CODE: (details) =>
    `Código incorrecto. Te quedan ${String(details.attemptsLeft ?? 0)} intentos.`,
  LOCKED: (details) => `Demasiados intentos. Vuelve a probar a las ${untilText(details)}.`,
  ALREADY_DRAWN: () => 'El sorteo ya se hizo.',
  NOT_ENOUGH_PEOPLE: (details) =>
    `Se necesitan al menos ${String(details.minimum ?? 3)} personas para sortear.`,
  DRAW_IMPOSSIBLE: (details) =>
    `Con esas exclusiones no hay sorteo posible. Revisa a: ${namesText(details)}.`,
  INTERNAL: () => 'Algo salió mal. Inténtalo otra vez.',
  NETWORK: () => 'Sin conexión. Revisa tu internet.',
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code](error.details);
  return MESSAGES.INTERNAL({});
}
