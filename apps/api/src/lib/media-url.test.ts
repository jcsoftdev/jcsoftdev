/**
 * TDD RED — media-url helper tests
 *
 * Tests buildPublicMediaUrl (two-arg) and buildPublicMediaUrlWithBucket (three-arg).
 */

import { describe, expect, it } from 'vitest';
import { buildPublicMediaUrl, buildPublicMediaUrlWithBucket } from './media-url.js';

describe('buildPublicMediaUrl', () => {
  it('builds a correct URL from base and objectKey', () => {
    const url = buildPublicMediaUrl('posts/user/2024/01/abc.jpg', 'http://localhost:9000');
    expect(url).toBe('http://localhost:9000/posts/user/2024/01/abc.jpg');
  });

  it('strips trailing slash from minioPublicBase', () => {
    const url = buildPublicMediaUrl('media/img.png', 'https://minio.example.com/');
    expect(url).toBe('https://minio.example.com/media/img.png');
  });

  it('preserves special chars in objectKey (no encoding)', () => {
    const url = buildPublicMediaUrl('media/2024/01/my image (1).jpg', 'http://localhost:9000');
    expect(url).toBe('http://localhost:9000/media/2024/01/my image (1).jpg');
  });

  it('works with HTTPS production base', () => {
    const url = buildPublicMediaUrl(
      'posts/user-123/2026/01/uuid.webp',
      'https://minio.jcsoftdev.com'
    );
    expect(url).toBe('https://minio.jcsoftdev.com/posts/user-123/2026/01/uuid.webp');
  });
});

describe('buildPublicMediaUrlWithBucket', () => {
  it('includes bucket segment in URL', () => {
    const url = buildPublicMediaUrlWithBucket(
      'http://localhost:9000',
      'posts-media',
      'user/2026/img.jpg'
    );
    expect(url).toBe('http://localhost:9000/posts-media/user/2026/img.jpg');
  });

  it('strips trailing slash from base', () => {
    const url = buildPublicMediaUrlWithBucket('https://minio.example.com/', 'my-bucket', 'key.png');
    expect(url).toBe('https://minio.example.com/my-bucket/key.png');
  });
});
