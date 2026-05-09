/**
 * Public portfolio routes — no auth required.
 *
 * Implements (design §3):
 *   GET /api/v1/public/portfolio               — combined payload (projects + experiences)
 *   GET /api/v1/public/portfolio/projects      — projects slice (from combined cache)
 *   GET /api/v1/public/portfolio/experiences   — experiences slice (from combined cache)
 *
 * Cache strategy (ADR-13):
 *   - Single key `public:portfolio:v1`, TTL 300s
 *   - Cache stores SERIALIZED payload (sanitized HTML pre-computed)
 *   - All 3 routes read from the same combined cache entry
 *   - Invalidated by admin write routes (projects.ts / experiences.ts)
 *
 * Sort:
 *   - projects: featured_order ASC NULLS LAST, started_at DESC
 *   - experiences: display_order ASC
 *
 * Markdown sanitization (ADR-14):
 *   - description → descriptionHtml (sanitized at serialization time)
 *   - summary     → summaryHtml (sanitized at serialization time)
 */

import type { DbClient } from '@jcsoftdev/db';
import { experiences, media, projects } from '@jcsoftdev/db';
import { asc, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { sanitizeMarkdown } from '../lib/markdown.js';
import { buildPublicMediaUrlWithBucket } from '../lib/media-url.js';
import { getCachedPortfolio } from '../lib/portfolio-cache.js';
import type { ValkeyClient } from '../lib/valkey.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicProjectItem = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  descriptionHtml: string;
  repoUrl: string | null;
  liveUrl: string | null;
  featuredOrder: number | null;
  startedAt: string | null;
  endedAt: string | null;
  heroImageUrl: string | null;
};

export type PublicExperienceItem = {
  id: string;
  company: string;
  role: string;
  summaryHtml: string;
  startedAt: string;
  endedAt: string | null;
  location: string | null;
  displayOrder: number | null;
};

export type PublicPortfolioPayload = {
  projects: { items: PublicProjectItem[] };
  experiences: { items: PublicExperienceItem[] };
};

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

type ProjectWithMedia = {
  project: typeof projects.$inferSelect;
  media: { objectKey: string; bucket: string } | null;
};

function serializePublicProject(
  row: ProjectWithMedia | typeof projects.$inferSelect,
  minioPublicBase?: string
): PublicProjectItem {
  // Support both flat project row and { project, media } leftJoin shape
  const isJoined = 'project' in row;
  const proj = isJoined ? (row as ProjectWithMedia).project : (row as typeof projects.$inferSelect);
  const mediaRow = isJoined ? (row as ProjectWithMedia).media : null;

  let heroImageUrl: string | null = null;
  if (mediaRow && minioPublicBase) {
    heroImageUrl = buildPublicMediaUrlWithBucket(
      minioPublicBase,
      mediaRow.bucket,
      mediaRow.objectKey
    );
  }

  return {
    id: proj.id,
    slug: proj.slug,
    name: proj.name,
    summary: proj.summary ?? null,
    descriptionHtml: sanitizeMarkdown(proj.description ?? ''),
    repoUrl: proj.repoUrl ?? null,
    liveUrl: proj.liveUrl ?? null,
    featuredOrder: proj.featuredOrder ?? null,
    startedAt: proj.startedAt ?? null,
    endedAt: proj.endedAt ?? null,
    heroImageUrl,
  };
}

function serializePublicExperience(exp: typeof experiences.$inferSelect): PublicExperienceItem {
  return {
    id: exp.id,
    company: exp.company,
    role: exp.role,
    summaryHtml: sanitizeMarkdown(exp.summary ?? ''),
    startedAt: exp.startedAt,
    endedAt: exp.endedAt ?? null,
    location: exp.location ?? null,
    displayOrder: exp.displayOrder ?? null,
  };
}

// ---------------------------------------------------------------------------
// DB fetcher — called on cache miss
// ---------------------------------------------------------------------------

async function fetchPortfolioFromDb(
  db: DbClient,
  minioPublicBase?: string
): Promise<PublicPortfolioPayload> {
  // Projects: LEFT JOIN media for hero image
  // Sort: featured_order ASC NULLS LAST, started_at DESC
  const projectRows = await db
    .select({
      project: projects,
      media: {
        objectKey: media.objectKey,
        bucket: media.bucket,
      },
    })
    .from(projects)
    .leftJoin(media, sql`${projects.heroMediaId} = ${media.id}`)
    .orderBy(sql`${projects.featuredOrder} ASC NULLS LAST`, sql`${projects.startedAt} DESC`);

  // Experiences: sort by display_order ASC
  const experienceRows = await db.select().from(experiences).orderBy(asc(experiences.displayOrder));

  const projectItems = projectRows.map((row) => serializePublicProject(row, minioPublicBase));
  const experienceItems = experienceRows.map(serializePublicExperience);

  return {
    projects: { items: projectItems },
    experiences: { items: experienceItems },
  };
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createPublicPortfolioRouter(
  db: DbClient,
  valkey: ValkeyClient,
  minioPublicBase?: string
) {
  const router = new Hono()

    // -------------------------------------------------------------------------
    // GET /api/v1/public/portfolio — combined payload
    // -------------------------------------------------------------------------
    .get('/', async (c) => {
      const payload = await getCachedPortfolio(valkey, () =>
        fetchPortfolioFromDb(db, minioPublicBase)
      );
      return c.json(payload);
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/public/portfolio/projects — projects slice
    // -------------------------------------------------------------------------
    .get('/projects', async (c) => {
      const payload = await getCachedPortfolio(valkey, () =>
        fetchPortfolioFromDb(db, minioPublicBase)
      );
      return c.json(payload.projects);
    })

    // -------------------------------------------------------------------------
    // GET /api/v1/public/portfolio/experiences — experiences slice
    // -------------------------------------------------------------------------
    .get('/experiences', async (c) => {
      const payload = await getCachedPortfolio(valkey, () =>
        fetchPortfolioFromDb(db, minioPublicBase)
      );
      return c.json(payload.experiences);
    });

  return router;
}
