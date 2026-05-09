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

// ---------------------------------------------------------------------------
// Types — mirror the API serializer output (serializePublicProject/Experience)
// ---------------------------------------------------------------------------

export interface PublicProject {
  id: string;
  slug: string;
  name: string;
  summary: string;
  /** Sanitized HTML — sanitized server-side by isomorphic-dompurify (ADR-14). */
  descriptionHtml: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  featuredOrder: number | null;
  /** ISO date string "YYYY-MM-DD" */
  startedAt: string;
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
  displayOrder: number;
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
export async function fetchPortfolio(): Promise<PortfolioResult> {
  // biome-ignore lint/suspicious/noExplicitAny: hc<AppType> union inference limitation — public routes require any cast
  const res = await (api as any).api.v1.public.portfolio.$get();

  if (!res.ok) {
    throw new Error(`Failed to fetch portfolio data: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    projects: { items: PublicProject[] };
    experiences: { items: PublicExperience[] };
  };

  return {
    projects: data.projects.items,
    experiences: data.experiences.items,
  };
}
