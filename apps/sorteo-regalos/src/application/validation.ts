import { AppError } from './errors';
import { MAX_PARTICIPANT_NAME_LENGTH, MAX_ROOM_NAME_LENGTH } from './limits';

const CODE_PATTERN = /^\d{4}$/;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new AppError('INVALID_INPUT');
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) throw new AppError('INVALID_INPUT');
  return cleaned;
}

export function parseRoomName(value: unknown): string {
  return cleanText(value, MAX_ROOM_NAME_LENGTH);
}

export function parseParticipantName(value: unknown): string {
  return cleanText(value, MAX_PARTICIPANT_NAME_LENGTH);
}

export function toNameKey(name: string): string {
  return name.toLocaleLowerCase('es');
}

export function parseCode(value: unknown): string {
  if (typeof value !== 'string' || !CODE_PATTERN.test(value)) throw new AppError('INVALID_INPUT');
  return value;
}

export function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AppError('INVALID_INPUT');
  }
  return [...new Set(value as string[])];
}

export function parseId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError('INVALID_INPUT');
  return value;
}
