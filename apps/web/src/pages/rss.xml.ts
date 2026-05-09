/**
 * RSS 2.0 feed for blog posts.
 *
 * Discoverable via <link rel="alternate" type="application/rss+xml"> in
 * RootLayout, helpful for both readers and search engine crawlers.
 */

import type { APIRoute } from 'astro';
import { fetchBlogPosts } from '../lib/blog-fetch';
import { AUTHOR_EMAIL, AUTHOR_NAME, SITE_NAME, SITE_URL } from '../lib/seo';

export const prerender = false;

const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const { items } = await fetchBlogPosts({ cursor: null, limit: MAX_ITEMS });

  const lastBuild = items[0]?.updatedAt ?? new Date().toISOString();

  const itemsXml = items
    .map((post) => {
      const link = `${SITE_URL}/blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt ?? post.updatedAt).toUTCString();
      const description = post.excerpt
        ? escapeXml(post.excerpt)
        : `Read "${escapeXml(post.title)}" on ${SITE_NAME}.`;
      return (
        `    <item>\n` +
        `      <title>${escapeXml(post.title)}</title>\n` +
        `      <link>${escapeXml(link)}</link>\n` +
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>\n` +
        `      <pubDate>${pubDate}</pubDate>\n` +
        `      <description>${description}</description>\n` +
        `      <author>${AUTHOR_EMAIL} (${AUTHOR_NAME})</author>\n` +
        `    </item>`
      );
    })
    .join('\n');

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(`${SITE_NAME} — Writing`)}</title>\n` +
    `    <link>${SITE_URL}/blog</link>\n` +
    `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    `    <description>Engineering articles, tutorials, and notes on full-stack development.</description>\n` +
    `    <language>en-us</language>\n` +
    `    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>\n` +
    itemsXml +
    `\n  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
};
