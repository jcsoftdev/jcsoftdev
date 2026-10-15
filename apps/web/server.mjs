// Production entry. Wraps the @astrojs/node standalone handler with one thing
// it lacks: compressed static assets. Hashed files under /_astro are served
// from the .br/.gz siblings written by scripts/precompress.mjs; everything
// else (SSR pages, which src/middleware.ts compresses, and other public files)
// goes to the adapter unchanged.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');

const ASSETS_DIR = fileURLToPath(new URL('./dist/client/_astro/', import.meta.url));
const TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};
const CODINGS = [
  ['br', '.br'],
  ['gzip', '.gz'],
];

/** Codings the client accepts, in our preference order (q=0 refuses one). */
function accepted(header) {
  if (typeof header !== 'string') return [];
  const refused = new Set();
  const listed = new Set();
  for (const part of header.toLowerCase().split(',')) {
    const [name, ...params] = part.trim().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    if (q && Number.parseFloat(q.slice(2)) === 0) refused.add(name.trim());
    else listed.add(name.trim());
  }
  return CODINGS.filter(([name]) => !refused.has(name) && (listed.has(name) || listed.has('*')));
}

async function servePrecompressed(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const pathname = decodeURIComponent((req.url ?? '').split('?')[0]);
  if (!pathname.startsWith('/_astro/')) return false;
  const file = path.join(ASSETS_DIR, pathname.slice('/_astro/'.length));
  if (!file.startsWith(ASSETS_DIR)) return false;
  const type = TYPES[path.extname(file)];
  if (!type) return false;

  for (const [coding, ext] of accepted(req.headers['accept-encoding'])) {
    const info = await stat(file + ext).catch(() => null);
    if (!info?.isFile()) continue;
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Encoding': coding,
      'Content-Length': info.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      Vary: 'Accept-Encoding',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file + ext).pipe(res);
    return true;
  }
  // The identity copy still varies by coding, or a shared cache could hand it
  // (or the brotli copy) to the wrong client.
  res.setHeader('Vary', 'Accept-Encoding');
  return false;
}

const server = http.createServer((req, res) => {
  servePrecompressed(req, res)
    .then((served) => {
      if (!served) handler(req, res);
    })
    .catch(() => handler(req, res));
});

const host = process.env.HOST ?? 'localhost';
const port = Number(process.env.PORT ?? 4321);
server.listen(port, host, () => {
  console.log(`[web] listening on http://${host}:${port}`);
});
