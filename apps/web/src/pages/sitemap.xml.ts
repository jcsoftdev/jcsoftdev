/**
 * Single source-of-truth sitemap.
 *
 * Combines static routes (home, blog index) with dynamic blog post URLs
 * fetched from the public API. Replaces @astrojs/sitemap entirely — that
 * integration only emits prerendered routes, but every page in this app
 * is SSR (`output: 'server'` + `prerender = false`), so it produced an
 * effectively empty sitemap.
 *
 * Output: standard sitemaps.org urlset XML.
 * Cache: 5min public + 10min CDN, plenty for crawler revisits.
 */

import type { APIRoute } from 'astro';
import { fetchBlogPosts } from '../lib/blog-fetch';
import { SITE_URL } from '../lib/seo';

export const prerender = false;

const MAX_PAGES = 50;
const PAGE_SIZE = 50;

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function entryToXml(entry: SitemapEntry): string {
  const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority !== undefined)
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  return `  <url>\n${lines.join('\n')}\n  </url>`;
}

async function collectPostEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchBlogPosts({ cursor, limit: PAGE_SIZE });
    for (const post of result.items) {
      entries.push({
        loc: `${SITE_URL}/blog/${post.slug}`,
        lastmod: post.updatedAt,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return entries;
}

export const GET: APIRoute = async () => {
  const now = new Date().toISOString();

  const staticEntries: SitemapEntry[] = [
    { loc: `${SITE_URL}/`, lastmod: now, changefreq: 'weekly', priority: 1.0 },
    { loc: `${SITE_URL}/blog`, lastmod: now, changefreq: 'daily', priority: 0.8 },
  ];

  let postEntries: SitemapEntry[] = [];
  try {
    postEntries = await collectPostEntries();
  } catch {
    // If the API is unreachable, still emit a valid sitemap with static entries.
    postEntries = [];
  }

  const allEntries = [...staticEntries, ...postEntries];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allEntries.map(entryToXml).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
};
