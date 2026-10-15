// Writes .br and .gz siblings for every compressible file under dist/client,
// so server.mjs can serve them without compressing on each request.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const CLIENT_DIR = fileURLToPath(new URL('../dist/client/', import.meta.url));
const EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.xml',
  '.txt',
  '.webmanifest',
]);
const MIN_BYTES = 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let files = 0;
let before = 0;
let after = 0;
for await (const file of walk(CLIENT_DIR)) {
  if (!EXTENSIONS.has(path.extname(file))) continue;
  if ((await stat(file)).size < MIN_BYTES) continue;
  const source = await readFile(file);
  const [br, gz] = await Promise.all([
    brotli(source, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
    gzip(source, { level: 9 }),
  ]);
  await Promise.all([writeFile(`${file}.br`, br), writeFile(`${file}.gz`, gz)]);
  files += 1;
  before += source.length;
  after += br.length;
}

console.log(
  `[precompress] ${files} files, ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB brotli`
);
