/** Content codings the server produces, best first. */
export type ContentCoding = 'br' | 'gzip';

const PREFERENCE: readonly ContentCoding[] = ['br', 'gzip'];

/**
 * Picks the response coding from an Accept-Encoding header. A coding listed
 * with q=0 is refused; `*` accepts anything not listed explicitly.
 */
export function pickEncoding(acceptEncoding: string | null | undefined): ContentCoding | null {
  if (!acceptEncoding) return null;
  const weights = new Map<string, number>();
  for (const part of acceptEncoding.split(',')) {
    const [rawName, ...params] = part.trim().toLowerCase().split(';');
    const name = rawName?.trim();
    if (!name) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const weight = q ? Number.parseFloat(q.slice(2)) : 1;
    weights.set(name, Number.isNaN(weight) ? 0 : weight);
  }
  const wildcard = weights.get('*');
  for (const coding of PREFERENCE) {
    const weight = weights.get(coding) ?? wildcard ?? 0;
    if (weight > 0) return coding;
  }
  return null;
}

const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|xml|rss\+xml|atom\+xml|manifest\+json|ld\+json)|image\/svg\+xml)/;

/** True for the textual media types that are worth compressing. */
export function isCompressible(contentType: string | null | undefined): boolean {
  return !!contentType && COMPRESSIBLE.test(contentType.toLowerCase());
}

/** Adds Accept-Encoding to Vary without dropping what is already there. */
export function withVaryAcceptEncoding(vary: string | null): string {
  if (!vary) return 'Accept-Encoding';
  if (vary.trim() === '*' || /(^|,)\s*accept-encoding\s*(,|$)/i.test(vary)) return vary;
  return `${vary}, Accept-Encoding`;
}

/**
 * Whether a response should be compressed on the way out: a textual body that
 * is not already encoded, for a request that accepts a coding we produce.
 */
export function shouldCompress(request: Request, response: Response): ContentCoding | null {
  if (request.method === 'HEAD' || !response.body) return null;
  if (response.status < 200 || response.status === 204 || response.status === 304) return null;
  if (response.headers.has('content-encoding')) return null;
  if (!isCompressible(response.headers.get('content-type'))) return null;
  return pickEncoding(request.headers.get('accept-encoding'));
}
