import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SEALED_VERSION = 'v1';
const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ROOM_ID_LENGTH = 8;
const TOKEN_BYTES = 32;

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretsMatch(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function textsMatch(first: string, second: string): boolean {
  const left = Buffer.from(first);
  const right = Buffer.from(second);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function newRoomId(): string {
  return Array.from(
    { length: ROOM_ID_LENGTH },
    () => ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)]
  ).join('');
}

export function newCode(): string {
  return String(randomInt(10_000)).padStart(4, '0');
}

export function secureRandom(): number {
  return randomInt(2 ** 32) / 2 ** 32;
}

export interface Sealer {
  seal(plain: string, context: string): string;
  open(sealed: string, context: string): string;
}

export function createSealer(keyBase64: string): Sealer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('ASSIGNMENT_KEY must be 32 bytes encoded as base64');
  }
  return {
    seal(plain, context) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from(context));
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [SEALED_VERSION, iv, cipher.getAuthTag(), body]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join('.');
    },
    open(sealed, context) {
      const [version, iv, tag, body] = sealed.split('.');
      if (version !== SEALED_VERSION || !iv || !tag || !body) {
        throw new Error('Unsupported sealed value');
      }
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}

export function developmentKey(): string {
  return createHash('sha256').update('sorteo-regalos-development-key').digest('base64');
}
