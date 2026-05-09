/**
 * Rasterize favicon.svg + apple-touch-icon.svg into PNGs.
 *
 * Run from the repo root or apps/web — script resolves paths from its own
 * location. Used to keep raster fallbacks (Google SERP, link previewers,
 * older iOS, Android PWA) in sync with the SVG source of truth.
 *
 * Usage: node apps/web/scripts/build-icons.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, '..', 'public');
const FAVICON_SVG = join(PUBLIC_DIR, 'favicon.svg');
const APPLE_SVG = join(PUBLIC_DIR, 'apple-touch-icon.svg');

const targets = [
  { name: 'favicon-32x32.png', svg: FAVICON_SVG, size: 32 },
  { name: 'favicon-48x48.png', svg: FAVICON_SVG, size: 48 },
  { name: 'icon-192.png', svg: FAVICON_SVG, size: 192 },
  { name: 'icon-512.png', svg: FAVICON_SVG, size: 512 },
  { name: 'apple-touch-icon.png', svg: APPLE_SVG, size: 180 },
];

const svgCache = new Map();

async function loadSvg(path) {
  if (!svgCache.has(path)) {
    svgCache.set(path, await readFile(path));
  }
  return svgCache.get(path);
}

async function main() {
  for (const { name, svg, size } of targets) {
    const source = await loadSvg(svg);
    const png = new Resvg(source, {
      fitTo: { mode: 'width', value: size },
    })
      .render()
      .asPng();
    await writeFile(join(PUBLIC_DIR, name), png);
    console.log(`✓ ${name} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
