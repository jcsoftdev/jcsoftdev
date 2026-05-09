/**
 * TDD RED → GREEN — portfolio-fetch.ts helper tests.
 *
 * Mirrors blog-fetch.test.ts pattern:
 * - vi.mock hoisted; factory uses vi.fn() inline
 * - (api as any) cast for AppType union limitation
 * - Tests: happy-path returns typed shape, error path
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchPortfolio } from './portfolio-fetch.js';

// vi.mock is hoisted above imports — factory must be self-contained.
vi.mock('./api.js', () => ({
  api: {
    api: {
      v1: {
        public: {
          portfolio: {
            $get: vi.fn(),
          },
        },
      },
    },
  },
}));

async function getMocks() {
  // biome-ignore lint/suspicious/noExplicitAny: AppType union — portfolio route not in inferred common subset
  const { api } = (await import('./api.js')) as any;
  return {
    portfolioGet: api.api.v1.public.portfolio.$get as ReturnType<typeof vi.fn>,
  };
}

// ---------------------------------------------------------------------------
// fetchPortfolio
// ---------------------------------------------------------------------------

describe('fetchPortfolio', () => {
  it('returns { projects, experiences } shape on success', async () => {
    const { portfolioGet } = await getMocks();

    portfolioGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: {
          items: [
            {
              id: 'proj-1',
              slug: 'my-project',
              name: 'My Project',
              summary: 'A cool project',
              descriptionHtml: '<p>Details</p>',
              repoUrl: 'https://github.com/user/repo',
              liveUrl: null,
              featuredOrder: 1,
              startedAt: '2024-01-01',
              endedAt: null,
              heroImageUrl: null,
            },
          ],
        },
        experiences: {
          items: [
            {
              id: 'exp-1',
              company: 'Acme Corp',
              role: 'Software Engineer',
              summaryHtml: '<p>Built things</p>',
              startedAt: '2021-01-01',
              endedAt: '2023-06-01',
              location: 'Remote',
              displayOrder: 1,
            },
          ],
        },
      }),
    });

    const result = await fetchPortfolio();

    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.slug).toBe('my-project');
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0]?.company).toBe('Acme Corp');
  });

  it('returns empty arrays when API returns empty items', async () => {
    const { portfolioGet } = await getMocks();

    portfolioGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: { items: [] },
        experiences: { items: [] },
      }),
    });

    const result = await fetchPortfolio();

    expect(result.projects).toHaveLength(0);
    expect(result.experiences).toHaveLength(0);
  });

  it('projects include heroImageUrl field (string or null)', async () => {
    const { portfolioGet } = await getMocks();
    const heroUrl = 'http://localhost:9000/posts-media/posts/user1/img.jpg';

    portfolioGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        projects: {
          items: [
            {
              id: 'proj-2',
              slug: 'hero-project',
              name: 'Hero Project',
              summary: 'Has a hero image',
              descriptionHtml: '<p>Content</p>',
              repoUrl: null,
              liveUrl: null,
              featuredOrder: null,
              startedAt: '2024-06-01',
              endedAt: null,
              heroImageUrl: heroUrl,
            },
          ],
        },
        experiences: { items: [] },
      }),
    });

    const result = await fetchPortfolio();

    expect(result.projects[0]?.heroImageUrl).toBe(heroUrl);
  });

  it('throws when API returns non-ok response', async () => {
    const { portfolioGet } = await getMocks();

    portfolioGet.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(fetchPortfolio()).rejects.toThrow(/portfolio/i);
  });
});
