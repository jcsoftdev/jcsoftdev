/**
 * Guards for /rss.xml and /sitemap.xml.
 *
 * Both were broken in production for days and neither failed loudly:
 *   - /rss.xml returned 500 with a zero-byte body, so subscribers saw a dead
 *     feed rather than an empty one.
 *   - /sitemap.xml caught its own failure and returned 200 with 2 URLs while
 *     the blog had 6 posts, so nothing anywhere recorded that it had degraded
 *     and every post stayed invisible to crawlers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchBlogPosts = vi.fn();
const mockLog = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('../lib/blog-fetch', () => ({
  fetchBlogPosts: (...args: unknown[]) => mockFetchBlogPosts(...args),
}));
vi.mock('../lib/log', () => ({ log: mockLog }));

const post = (slug: string) => ({
  id: slug,
  slug,
  title: `Post ${slug}`,
  excerpt: 'excerpt',
  status: 'published',
  publishedAt: '2026-01-01T00:00:00.000Z',
  heroMediaId: null,
  heroImageUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const ctx = {} as never;

describe('/rss.xml', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it('serves a feed with an item per post', async () => {
    mockFetchBlogPosts.mockResolvedValue({ items: [post('a'), post('b')], nextCursor: null });

    const { GET } = await import('./rss.xml.js');
    const res = await GET(ctx);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body.match(/<item>/g) ?? []).toHaveLength(2);
    expect(body).toContain('https://jcsoftdev.com/blog/a');
  });

  it('degrades to a valid empty feed instead of a 500 when the API fails', async () => {
    mockFetchBlogPosts.mockRejectedValue(new Error('API down'));

    const { GET } = await import('./rss.xml.js');
    const res = await GET(ctx);
    const body = await res.text();

    // A 500 with no body is what makes readers unsubscribe.
    expect(res.status).toBe(200);
    expect(body).toContain('<rss');
    expect(body).toContain('</channel>');
    expect(body).not.toContain('<item>');
    expect(mockLog.error).toHaveBeenCalledWith('rss.fetch_failed', expect.anything());
  });

  it('does not let a degraded feed sit in the CDN', async () => {
    mockFetchBlogPosts.mockRejectedValue(new Error('API down'));

    const { GET } = await import('./rss.xml.js');
    const res = await GET(ctx);

    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30');
  });
});

describe('/sitemap.xml', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it('includes every post URL alongside the static routes', async () => {
    mockFetchBlogPosts.mockResolvedValue({
      items: ['a', 'b', 'c', 'd', 'e', 'f'].map(post),
      nextCursor: null,
    });

    const { GET } = await import('./sitemap.xml.js');
    const res = await GET(ctx);
    const body = await res.text();
    const urls = body.match(/<url>/g) ?? [];

    // 3 static (/, /blog, /resume) + 6 posts. The bug shipped 2.
    expect(urls).toHaveLength(9);
    expect(body).toContain('https://jcsoftdev.com/blog/f');
    expect(body).toContain('https://jcsoftdev.com/resume');
  });

  it('logs when the post fetch fails instead of silently under-reporting', async () => {
    mockFetchBlogPosts.mockRejectedValue(new Error('API down'));

    const { GET } = await import('./sitemap.xml.js');
    const res = await GET(ctx);
    const body = await res.text();

    // Still a valid sitemap — but no longer a silent one.
    expect(res.status).toBe(200);
    expect(body).toContain('<urlset');
    expect(mockLog.error).toHaveBeenCalledWith(
      'sitemap.posts_fetch_failed',
      expect.objectContaining({ err: expect.any(Error) })
    );
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=30');
  });

  it('distinguishes "API down" from "genuinely no posts"', async () => {
    mockFetchBlogPosts.mockResolvedValue({ items: [], nextCursor: null });

    const { GET } = await import('./sitemap.xml.js');
    await GET(ctx);

    expect(mockLog.warn).toHaveBeenCalledWith('sitemap.no_posts', expect.anything());
    expect(mockLog.error).not.toHaveBeenCalled();
  });
});
