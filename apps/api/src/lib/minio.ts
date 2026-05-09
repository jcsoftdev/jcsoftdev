import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Presigned URL expiry — 15 minutes.
 * Matches better-auth magic-link TTL for consistency.
 */
const PRESIGN_EXPIRES_IN = 900; // seconds

/**
 * Max allowed upload size: 5 MB.
 * Validation happens BEFORE presigning to prevent abuse.
 */
export const MAX_SIZE_BYTES = 5_242_880; // 5 * 1024 * 1024

/**
 * Allow-list of accepted image content types.
 * Matches the design spec (image/gif replaced by image/avif per design §9).
 */
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export interface MinioConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface PresignInput {
  userId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
}

/**
 * Slugify a filename while preserving the extension.
 * Converts spaces and non-alphanumeric chars to hyphens.
 */
function slugifyFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot !== -1 ? filename.slice(lastDot) : '';

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug}${ext.toLowerCase()}`;
}

/**
 * MinIO presigner factory.
 *
 * Returns a helper that validates upload params and issues a presigned PUT URL
 * for direct browser-to-MinIO uploads (ADR-5: presigned PUT pattern).
 *
 * Validation is performed BEFORE calling the AWS SDK to avoid generating
 * credentials for requests we would reject anyway.
 */
export function createMinioPresigner(config: MinioConfig) {
  const s3 = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // required for MinIO — bucket name in path, not subdomain
  });

  return {
    /**
     * Validate + generate a presigned PUT URL.
     *
     * @throws Error with message matching /size/i when sizeBytes > MAX_SIZE_BYTES
     * @throws Error with message matching /content.?type/i when contentType not in allow-list
     */
    async createPresignedPutUrl(input: PresignInput): Promise<PresignedUploadResult> {
      // Validate size FIRST — cheapest check
      if (input.sizeBytes > MAX_SIZE_BYTES) {
        throw new Error(
          `File size ${input.sizeBytes} bytes exceeds maximum allowed size of ${MAX_SIZE_BYTES} bytes (5 MB)`
        );
      }

      // Validate content type
      if (!ALLOWED_CONTENT_TYPES.includes(input.contentType as AllowedContentType)) {
        throw new Error(
          `Content-Type '${input.contentType}' is not allowed. Accepted types: ${ALLOWED_CONTENT_TYPES.join(', ')}`
        );
      }

      // Build a deterministic, URL-safe object key:
      // posts/{userId}/{yyyy}/{mm}/{uuid}-{slug-safe-filename}
      const now = new Date();
      const yyyy = now.getFullYear().toString();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const uuid = crypto.randomUUID();
      const safeFilename = slugifyFilename(input.filename);
      const objectKey = `posts/${input.userId}/${yyyy}/${mm}/${uuid}-${safeFilename}`;

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRES_IN });

      return { uploadUrl, objectKey };
    },
  };
}
