import { describe, expect, it } from 'vitest';

// We import the schema-only export for testing (not the parsed singleton)
import { EnvSchema } from './env.js';

const VALID_ENV = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:6432/mydb',
  DATABASE_DIRECT_URL: 'postgresql://user:pass@localhost:5432/mydb',
  VALKEY_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a-sufficiently-long-secret-for-tests-123456',
  BETTER_AUTH_URL: 'http://localhost:3000',
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM_EMAIL: 'hello@example.com',
  MINIO_ENDPOINT: 'http://localhost:9000',
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
  CORS_ORIGINS: 'http://localhost:4321,http://localhost:5173',
};

describe('EnvSchema', () => {
  describe('valid env', () => {
    it('parses a fully valid env without error', () => {
      const result = EnvSchema.safeParse(VALID_ENV);
      expect(result.success).toBe(true);
    });

    it('returns typed parsed data for all required fields', () => {
      const result = EnvSchema.safeParse(VALID_ENV);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.DATABASE_URL).toBe('postgresql://user:pass@localhost:6432/mydb');
      expect(result.data.DATABASE_DIRECT_URL).toBe('postgresql://user:pass@localhost:5432/mydb');
      expect(result.data.VALKEY_URL).toBe('redis://localhost:6379');
      expect(result.data.BETTER_AUTH_SECRET).toBe('a-sufficiently-long-secret-for-tests-123456');
      expect(result.data.BETTER_AUTH_URL).toBe('http://localhost:3000');
      expect(result.data.RESEND_API_KEY).toBe('re_test_key');
      expect(result.data.RESEND_FROM_EMAIL).toBe('hello@example.com');
      expect(result.data.MINIO_ENDPOINT).toBe('http://localhost:9000');
      expect(result.data.MINIO_ACCESS_KEY).toBe('minioadmin');
      expect(result.data.MINIO_SECRET_KEY).toBe('minioadmin');
      expect(result.data.PORT).toBe(3000);
    });

    it('splits CORS_ORIGINS CSV into an array', () => {
      const result = EnvSchema.safeParse(VALID_ENV);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.CORS_ORIGINS).toEqual(['http://localhost:4321', 'http://localhost:5173']);
    });

    it('trims whitespace from CORS_ORIGINS entries', () => {
      const result = EnvSchema.safeParse({
        ...VALID_ENV,
        CORS_ORIGINS: '  http://localhost:4321 , http://localhost:5173  ',
      });
      if (!result.success) throw new Error('Expected success');
      expect(result.data.CORS_ORIGINS).toEqual(['http://localhost:4321', 'http://localhost:5173']);
    });

    it('uses defaults: NODE_ENV=development, MINIO_REGION=us-east-1, MINIO_BUCKET_MEDIA=posts-media', () => {
      const { NODE_ENV, ...withoutNodeEnv } = VALID_ENV;
      const result = EnvSchema.safeParse(withoutNodeEnv);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.MINIO_REGION).toBe('us-east-1');
      expect(result.data.MINIO_BUCKET_MEDIA).toBe('posts-media');
    });

    it('accepts optional COOKIE_DOMAIN when set', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, COOKIE_DOMAIN: '.jcsoftdev.com' });
      if (!result.success) throw new Error('Expected success');
      expect(result.data.COOKIE_DOMAIN).toBe('.jcsoftdev.com');
    });

    it('COOKIE_DOMAIN is undefined when not set', () => {
      const result = EnvSchema.safeParse(VALID_ENV);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.COOKIE_DOMAIN).toBeUndefined();
    });
  });

  describe('missing required vars', () => {
    it('fails when RESEND_API_KEY is missing', () => {
      const { RESEND_API_KEY, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when DATABASE_URL is missing', () => {
      const { DATABASE_URL, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when DATABASE_DIRECT_URL is missing', () => {
      const { DATABASE_DIRECT_URL, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when VALKEY_URL is missing', () => {
      const { VALKEY_URL, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when BETTER_AUTH_SECRET is missing', () => {
      const { BETTER_AUTH_SECRET, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when MINIO_ENDPOINT is missing', () => {
      const { MINIO_ENDPOINT, ...rest } = VALID_ENV;
      const result = EnvSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('URL field validation', () => {
    it('fails when DATABASE_URL is not a valid URL', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, DATABASE_URL: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('fails when DATABASE_DIRECT_URL is not a valid URL', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, DATABASE_DIRECT_URL: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('fails when VALKEY_URL is not a valid URL', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, VALKEY_URL: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('fails when MINIO_ENDPOINT is not a valid URL', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, MINIO_ENDPOINT: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('fails when RESEND_FROM_EMAIL is not a valid email', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, RESEND_FROM_EMAIL: 'not-an-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('BETTER_AUTH_SECRET min length', () => {
    it('fails when BETTER_AUTH_SECRET is shorter than 32 chars', () => {
      const result = EnvSchema.safeParse({ ...VALID_ENV, BETTER_AUTH_SECRET: 'short' });
      expect(result.success).toBe(false);
    });

    it('passes when BETTER_AUTH_SECRET is exactly 32 chars', () => {
      const result = EnvSchema.safeParse({
        ...VALID_ENV,
        BETTER_AUTH_SECRET: 'a'.repeat(32),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('MINIO_PUBLIC_URL', () => {
    it('accepts optional MINIO_PUBLIC_URL when set', () => {
      const result = EnvSchema.safeParse({
        ...VALID_ENV,
        MINIO_PUBLIC_URL: 'https://minio.jcsoftdev.com',
      });
      if (!result.success) throw new Error('Expected success');
      expect(result.data.MINIO_PUBLIC_URL).toBe('https://minio.jcsoftdev.com');
    });

    it('MINIO_PUBLIC_URL is undefined when not set', () => {
      const result = EnvSchema.safeParse(VALID_ENV);
      if (!result.success) throw new Error('Expected success');
      expect(result.data.MINIO_PUBLIC_URL).toBeUndefined();
    });
  });
});
