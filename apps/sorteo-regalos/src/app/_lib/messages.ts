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
  CANNOT_REMOVE: () =>
    'No se puede quitar a esta persona sin cambiar más resultados. Habría que rehacer el sorteo.',
  NOT_DRAWN: () => 'Primero haz el sorteo.',
  INTERNAL: () => 'Algo salió mal. Inténtalo otra vez.',
  NETWORK: () => 'Sin conexión. Revisa tu internet.',
};

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code](error.details);
  return MESSAGES.INTERNAL({});
}

export function newcomersNote(pending: number): string {
  if (pending === 0)
    return 'Aún no hay personas nuevas. Si ya no esperas a nadie, cierra las inscripciones.';
  const people = pending === 1 ? '1 persona nueva' : `${pending} personas nuevas`;
  return `Hay ${people}. Al sortear, entran a la cadena del sorteo y a una sola persona que ya tenía resultado le cambiará: después pide a todos que revisen su enlace.`;
}

export function drawNewcomersLabel(pending: number): string {
  return pending === 0 ? 'Cerrar inscripciones' : `Sortear a los nuevos (${pending})`;
}

export const RESULT_CHANGED_NOTICE =
  'Listo. A una persona que ya tenía resultado le cambió: pide en el grupo que todos vuelvan a abrir su enlace.';

export function removalWarning(name: string, drawn: boolean): string {
  return drawn
    ? `Quien le regalaba a ${name} pasará a regalarle a quien le tocaba a ${name}. Nadie más cambia.`
    : `${name} saldrá de la sala.`;
}

export function drawStatusSummary(soundCount: number, total: number): string {
  return soundCount === total
    ? `Todo conforme: ${soundCount} de ${total} personas tienen a quién regalar y alguien les regala.`
    : `Revisar: solo ${soundCount} de ${total} personas están conformes.`;
}
