/**
 * Media URL builder — shared helper for constructing public MinIO URLs.
 *
 * Both public-blog and public-portfolio routes need to resolve hero image
 * URLs. This module centralises the logic (design §3.1).
 *
 * Pattern: ${minioPublicBase}/${objectKey}
 *
 * The objectKey is stored in the `media` table and may or may not include
 * a bucket path prefix.  Routes that need the bucket in the URL should
 * pass `${bucket}/${objectKey}` as the objectKey argument, or use the
 * dedicated `buildPublicMediaUrlWithBucket` variant.
 */

/**
 * Construct a fully-qualified public URL for a MinIO object.
 *
 * @param objectKey     - Object key as stored in the `media` table
 * @param minioPublicBase - Public base URL (trailing slash stripped)
 */
export function buildPublicMediaUrl(objectKey: string, minioPublicBase: string): string {
  const base = minioPublicBase.replace(/\/$/, '');
  return `${base}/${objectKey}`;
}

/**
 * Construct a fully-qualified public URL for a MinIO object, explicitly
 * including the bucket segment in the path.
 *
 * Pattern: ${minioPublicBase}/${bucket}/${objectKey}
 *
 * @param minioPublicBase - Public base URL (trailing slash stripped)
 * @param bucket          - MinIO bucket name
 * @param objectKey       - Object key as stored in the `media` table
 */
export function buildPublicMediaUrlWithBucket(
  minioPublicBase: string,
  bucket: string,
  objectKey: string
): string {
  const base = minioPublicBase.replace(/\/$/, '');
  return `${base}/${bucket}/${objectKey}`;
}
