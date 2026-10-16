import { defineMiddleware } from 'astro:middleware';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { type ContentCoding, shouldCompress, withVaryAcceptEncoding } from './lib/http-encoding';

/**
 * Compresses server-rendered responses. The node adapter's standalone server
 * never sets Content-Encoding, so the home page went out as ~150 KB of raw
 * HTML; brotli at quality 5 takes ~2 ms and cuts it ~7x. Pages finish
 * rendering in milliseconds once their data is in, so the body is compressed
 * whole: piping Astro's many small chunks through a stream encoder measured
 * ~10 ms slower to first byte. Hashed `/_astro` assets are precompressed at
 * build time and served by server.mjs; they never reach this middleware.
 */
const ASTRO_COOKIES = Symbol.for('astro.cookies');

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

function compress(coding: ContentCoding, input: Uint8Array): Promise<Buffer> {
  return coding === 'br'
    ? brotli(input, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
    : gzip(input, { level: 6 });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (import.meta.env.DEV) return response;

  const coding = shouldCompress(context.request, response);
  if (!coding) return response;

  const body = await compress(coding, new Uint8Array(await response.arrayBuffer()));
  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', coding);
  headers.set('Content-Length', String(body.byteLength));
  headers.set('Vary', withVaryAcceptEncoding(headers.get('Vary')));

  const compressed = new Response(new Uint8Array(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  // Astro hangs Astro.cookies off the response it rendered; carry them over.
  const cookies = Reflect.get(response, ASTRO_COOKIES);
  if (cookies) Reflect.set(compressed, ASTRO_COOKIES, cookies);
  return compressed;
});
