import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these are available inside vi.mock factory (which is hoisted above imports)
const { mockGetSignedUrl, mockS3ClientConstructor } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/presigned-url'),
  mockS3ClientConstructor: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(config: unknown) {
      mockS3ClientConstructor(config);
    }
  }
  class PutObjectCommand {
    constructor(public params: Record<string, unknown>) {}
  }
  return { S3Client, PutObjectCommand };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import {
  ALLOWED_CONTENT_TYPES,
  createMinioPresigner,
  MAX_SIZE_BYTES,
  type PresignedUploadResult,
} from './minio.js';

const MINIO_CONFIG = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  bucket: 'posts-media',
};

describe('createMinioPresigner', () => {
  let presigner: ReturnType<typeof createMinioPresigner>;

  beforeEach(() => {
    vi.clearAllMocks();
    presigner = createMinioPresigner(MINIO_CONFIG);
  });

  describe('createPresignedPutUrl', () => {
    const VALID_REQUEST = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      filename: 'hero.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1_024_000, // 1 MB
    };

    it('returns an object with uploadUrl and objectKey for a valid request', async () => {
      const result: PresignedUploadResult = await presigner.createPresignedPutUrl(VALID_REQUEST);
      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('objectKey');
    });

    it('uploadUrl comes from the signed URL generator', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://minio.example.com/signed');
      const result = await presigner.createPresignedPutUrl(VALID_REQUEST);
      expect(result.uploadUrl).toBe('https://minio.example.com/signed');
    });

    it('objectKey includes the userId segment', async () => {
      const result = await presigner.createPresignedPutUrl(VALID_REQUEST);
      expect(result.objectKey).toContain(VALID_REQUEST.userId);
    });

    it('objectKey starts with posts/ prefix', async () => {
      const result = await presigner.createPresignedPutUrl(VALID_REQUEST);
      expect(result.objectKey).toMatch(/^posts\//);
    });

    it('objectKey ends with a sanitized version of the filename', async () => {
      const result = await presigner.createPresignedPutUrl({
        ...VALID_REQUEST,
        filename: 'My Hero Image.jpg',
      });
      // slug-safe: spaces → hyphens, lowercase
      expect(result.objectKey).toMatch(/my-hero-image\.jpg$/);
    });

    it('calls getSignedUrl with expiresIn: 900 seconds (15 min)', async () => {
      await presigner.createPresignedPutUrl(VALID_REQUEST);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 900 })
      );
    });

    describe('validation — oversize', () => {
      it('throws for a file exceeding MAX_SIZE_BYTES', async () => {
        await expect(
          presigner.createPresignedPutUrl({
            ...VALID_REQUEST,
            sizeBytes: MAX_SIZE_BYTES + 1,
          })
        ).rejects.toThrow(/size/i);
      });

      it('does NOT throw for a file exactly at MAX_SIZE_BYTES', async () => {
        await expect(
          presigner.createPresignedPutUrl({
            ...VALID_REQUEST,
            sizeBytes: MAX_SIZE_BYTES,
          })
        ).resolves.toBeDefined();
      });
    });

    describe('validation — content type', () => {
      it('throws for a disallowed content type', async () => {
        await expect(
          presigner.createPresignedPutUrl({
            ...VALID_REQUEST,
            contentType: 'application/pdf',
          })
        ).rejects.toThrow(/content.?type/i);
      });

      it('throws for application/octet-stream', async () => {
        await expect(
          presigner.createPresignedPutUrl({
            ...VALID_REQUEST,
            contentType: 'application/octet-stream',
          })
        ).rejects.toThrow(/content.?type/i);
      });

      it.each(ALLOWED_CONTENT_TYPES)('accepts %s as a valid content type', async (ct) => {
        await expect(
          presigner.createPresignedPutUrl({ ...VALID_REQUEST, contentType: ct })
        ).resolves.toHaveProperty('uploadUrl');
      });
    });
  });
});

describe('MAX_SIZE_BYTES', () => {
  it('equals 5 MB (5_242_880 bytes)', () => {
    expect(MAX_SIZE_BYTES).toBe(5_242_880);
  });
});

describe('ALLOWED_CONTENT_TYPES', () => {
  it('includes image/jpeg, image/png, image/webp, image/avif', () => {
    expect(ALLOWED_CONTENT_TYPES).toContain('image/jpeg');
    expect(ALLOWED_CONTENT_TYPES).toContain('image/png');
    expect(ALLOWED_CONTENT_TYPES).toContain('image/webp');
    expect(ALLOWED_CONTENT_TYPES).toContain('image/avif');
  });
});
