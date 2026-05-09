/**
 * Dynamic sitemap for blog posts.
 *
 * Astro's @astrojs/sitemap integration only emits static routes at build time.
 * Blog posts come from the API at runtime, so we expose them via this SSR
 * endpoint and reference it from robots.txt alongside /sitemap-index.xml.
 */

import type { APIRoute } from 'astro';
import { fetchBlogPosts } from '../lib/blog-fetch';
import { SITE_URL } from '../lib/seo';

export const prerender = false;

const MAX_PAGES = 50;
const PAGE_SIZE = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const urls: Array<{ loc: string; lastmod: string }> = [];

  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchBlogPosts({ cursor, limit: PAGE_SIZE });
    for (const post of result.items) {
      urls.push({
        loc: `${SITE_URL}/blog/${post.slug}`,
        lastmod: post.updatedAt,
      });
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${escapeXml(u.loc)}</loc>\n` +
          `    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n` +
          `    <changefreq>weekly</changefreq>\n` +
          `  </url>`
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
};
