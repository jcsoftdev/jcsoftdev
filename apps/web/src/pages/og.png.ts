/**
 * Dynamic Open Graph PNG endpoint.
 *
 * Query params:
 *   ?title=<string>         (required, max ~110 chars after truncation)
 *   ?description=<string>   (optional, max ~180 chars)
 *   ?eyebrow=<string>       (optional, e.g. "Writing", "Portfolio")
 *
 * Cached aggressively: 24h public + 1h SWR. Per-URL cache keys are
 * fully captured by the query string, so any title/description change
 * yields a fresh cache key automatically.
 */

import type { APIRoute } from 'astro';
import { renderOg } from '../lib/og';

export const prerender = false;

export const GET: APIRoute = async ({ url, site }) => {
  const title = url.searchParams.get('title');
  if (!title) {
    return new Response('Missing required query param: title', {
      status: 400,
    });
  }

  const description = url.searchParams.get('description') ?? undefined;
  const eyebrow = url.searchParams.get('eyebrow') ?? undefined;
  const origin = site?.origin ?? url.origin;

  try {
    const png = await renderOg({ title, description, eyebrow, origin });

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OG render failed';
    return new Response(message, { status: 500 });
  }
};
