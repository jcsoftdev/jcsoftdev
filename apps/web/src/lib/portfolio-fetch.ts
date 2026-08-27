/**
 * Portfolio fetch helpers — Phase 5 public portfolio SSR.
 *
 * Encapsulates all data-fetching logic for the /portfolio page so that:
 * 1. The Astro page stays thin (just import + render)
 * 2. The logic is unit-testable in Vitest without the Astro Container API
 *
 * Design §9 — single combined call to GET /api/v1/public/portfolio.
 * AppType strategy: (api as any) cast — same pattern as blog-fetch.ts.
 * Description/summary is already sanitized server-side at the API serialization
 * layer (Phase 3 — isomorphic-dompurify). DO NOT re-sanitize on the client.
 */

import { api } from './api.js';
import { fetchApiJson } from './fetch-api-json.js';
import { log } from './log.js';
import fallbackPayload from './portfolio.fallback.json';

// ---------------------------------------------------------------------------
// Types — mirror the API serializer output (serializePublicProject/Experience)
// ---------------------------------------------------------------------------

export interface PublicProject {
  id: string;
  slug: string;
  name: string;
  /** Nullable in the DB and serialized as `?? null` by the API. */
  summary: string | null;
  /** Sanitized HTML — sanitized server-side by isomorphic-dompurify (ADR-14). */
  descriptionHtml: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  featuredOrder: number | null;
  /** ISO date string "YYYY-MM-DD", or null — `projects.started_at` is nullable. */
  startedAt: string | null;
  /** ISO date string "YYYY-MM-DD" or null */
  endedAt: string | null;
  /** Fully resolved public MinIO URL when hero_media_id is set; null otherwise. */
  heroImageUrl: string | null;
}

export interface PublicExperience {
  id: string;
  company: string;
  role: string;
  /** Sanitized HTML — sanitized server-side by isomorphic-dompurify (ADR-14). */
  summaryHtml: string | null;
  /** ISO date string "YYYY-MM-DD" */
  startedAt: string;
  /** ISO date string "YYYY-MM-DD" or null */
  endedAt: string | null;
  location: string | null;
  /** Nullable in the DB and serialized as `?? null` by the API. */
  displayOrder: number | null;
}

export interface PortfolioResult {
  projects: PublicProject[];
  experiences: PublicExperience[];
}

// ---------------------------------------------------------------------------
// fetchPortfolio — combined SSR fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the combined portfolio data from GET /api/v1/public/portfolio.
 * Intended for SSR use in the /portfolio Astro page frontmatter.
 *
 * Returns { projects, experiences } as flat arrays (unwrapped from { items: [] }).
 * Throws on non-ok responses (let the caller handle or wrap in try/catch).
 */
/**
 * How stale the returned payload is.
 *
 * - `live`     — straight from the API.
 * - `cached`   — the last good response this process saw.
 * - `fallback` — the committed snapshot; the floor, never empty.
 */
export type PortfolioSource = 'live' | 'cached' | 'fallback';

export interface PortfolioResultWithSource extends PortfolioResult {
  source: PortfolioSource;
}

/** Last good response, kept per process. Not shared across instances — this is
 *  a per-instance cache, not a cache tier. */
let lastGood: PortfolioResult | null = null;
let lastGoodAt = 0;

/**
 * How long a cached payload is served without contacting the API.
 *
 * The homepage is prerender=false, so before this every single visitor paid a
 * round trip for content that changes a few times a year. 60s keeps the page
 * effectively live for editing while collapsing burst traffic onto one upstream
 * call — and it is the difference between an API blip being invisible and being
 * the first thing a visitor sees.
 */
const CACHE_TTL_MS = 60_000;

/** Injectable clock so the TTL is testable without wall-clock sleeps. */
let now = () => Date.now();

/** Test seam — override the clock. */
export function __setPortfolioClock(fn: () => number): void {
  now = fn;
}

/** Committed snapshot generated from the seed data (the same content the DB is
 *  seeded with), so the worst case is out-of-date rather than an empty page. */
const FALLBACK: PortfolioResult = {
  projects: fallbackPayload.projects as unknown as PublicProject[],
  experiences: fallbackPayload.experiences as unknown as PublicExperience[],
};

/**
 * Fetch the combined portfolio, degrading instead of failing.
 *
 * The homepage is `prerender = false`, so every visitor triggers this. When the
 * API went down, `fetchPortfolio` threw, index.astro caught it, and the page
 * rendered an error card next to "0 projects" and "0 roles" — developer copy in
 * front of whoever happened to be reading. Three layers now: live, last good,
 * committed snapshot. The page always has something to show.
 */
export async function fetchPortfolioResilient(): Promise<PortfolioResultWithSource> {
  // Fresh enough — skip the round trip entirely.
  if (lastGood && now() - lastGoodAt < CACHE_TTL_MS) {
    return { ...lastGood, source: 'cached' };
  }

  try {
    // biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast
    const res = await (api as any).api.v1.public.portfolio.$get();

    const data = await fetchApiJson<{
      projects: { items: PublicProject[] };
      experiences: { items: PublicExperience[] };
    }>(res, 'portfolio data');

    const result: PortfolioResult = {
      projects: data.projects.items,
      experiences: data.experiences.items,
    };

    // Only promote a response that actually carries content — an empty 200
    // must not overwrite a good cache or mask an upstream problem.
    if (result.projects.length > 0 || result.experiences.length > 0) {
      lastGood = result;
      lastGoodAt = now();
    }

    return { ...result, source: 'live' };
  } catch (err) {
    if (lastGood) {
      log.warn('portfolio.serving_cached', { err });
      return { ...lastGood, source: 'cached' };
    }
    log.error('portfolio.serving_fallback', { err });
    return { ...FALLBACK, source: 'fallback' };
  }
}

/**
 * Strict variant — throws on failure.
 *
 * Kept for callers that genuinely want the error (tests, and any future admin
 * surface). Page routes should use `fetchPortfolioResilient`.
 */
export async function fetchPortfolio(): Promise<PortfolioResult> {
  // biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast
  const res = await (api as any).api.v1.public.portfolio.$get();

  const data = await fetchApiJson<{
    projects: { items: PublicProject[] };
    experiences: { items: PublicExperience[] };
  }>(res, 'portfolio data');

  return {
    projects: data.projects.items,
    experiences: data.experiences.items,
  };
}

/** Test seam — reset the per-process cache between cases. */
export function __resetPortfolioCache(): void {
  lastGood = null;
  lastGoodAt = 0;
  now = () => Date.now();
}
