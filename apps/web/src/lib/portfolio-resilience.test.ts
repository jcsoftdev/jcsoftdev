/**
 * Regression tests for the outage that emptied the homepage.
 *
 * The public portfolio endpoint returned 500 for days. `fetchPortfolio` threw,
 * index.astro caught it, and the page rendered "Error loading data. Make sure
 * the API is running." next to "0 projects" and "0 roles · 9 years" — developer
 * copy in front of whoever was reading. These assert the page can no longer be
 * empty, whatever the API does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();

vi.mock('./api.js', () => ({
  api: { api: { v1: { public: { portfolio: { $get: () => mockGet() } } } } },
}));

// Keep the suite's output clean; the code under test logs on every degrade.
vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const live = {
  projects: { items: [{ id: 'p-live', slug: 'live', name: 'Live Project' }] },
  experiences: { items: [{ id: 'e-live', company: 'Live Co' }] },
};

async function load() {
  const mod = await import('./portfolio-fetch.js');
  mod.__resetPortfolioCache();
  return mod;
}

describe('fetchPortfolioResilient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns live data when the API answers', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, json: async () => live });

    const { fetchPortfolioResilient } = await load();
    const result = await fetchPortfolioResilient();

    expect(result.source).toBe('live');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.name).toBe('Live Project');
  });

  it('serves the last good response when the API starts failing', async () => {
    const { fetchPortfolioResilient } = await load();

    mockGet.mockResolvedValue({ ok: true, status: 200, json: async () => live });
    await fetchPortfolioResilient();

    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });
    const result = await fetchPortfolioResilient();

    expect(result.source).toBe('cached');
    expect(result.projects[0]?.name).toBe('Live Project');
  });

  it('falls back to the committed snapshot when there is no cache yet', async () => {
    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });

    const { fetchPortfolioResilient } = await load();
    const result = await fetchPortfolioResilient();

    expect(result.source).toBe('fallback');
    // This is the property that matters: never empty.
    expect(result.projects.length).toBeGreaterThan(0);
    expect(result.experiences.length).toBeGreaterThan(0);
  });

  it('never returns an empty payload, whatever the API does', async () => {
    for (const response of [
      { ok: false, status: 500, json: async () => ({}) },
      { ok: false, status: 404, json: async () => ({}) },
    ]) {
      mockGet.mockResolvedValue(response);
      const { fetchPortfolioResilient } = await load();
      const result = await fetchPortfolioResilient();
      expect(result.projects.length + result.experiences.length).toBeGreaterThan(0);
    }
  });

  it('does not let an empty 200 overwrite a good cache', async () => {
    const { fetchPortfolioResilient } = await load();

    mockGet.mockResolvedValue({ ok: true, status: 200, json: async () => live });
    await fetchPortfolioResilient();

    // An upstream that answers with nothing is a symptom, not fresh content.
    mockGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: { items: [] }, experiences: { items: [] } }),
    });
    await fetchPortfolioResilient();

    mockGet.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const result = await fetchPortfolioResilient();

    expect(result.source).toBe('cached');
    expect(result.projects[0]?.name).toBe('Live Project');
  });

  it('serves from cache within the TTL without contacting the API', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, json: async () => live });

    const mod = await load();
    let clock = 1_000_000;
    mod.__setPortfolioClock(() => clock);

    await mod.fetchPortfolioResilient();
    expect(mockGet).toHaveBeenCalledTimes(1);

    clock += 30_000; // inside the 60s window
    const cached = await mod.fetchPortfolioResilient();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(cached.source).toBe('cached');
    expect(cached.projects[0]?.name).toBe('Live Project');
  });

  it('revalidates once the TTL expires', async () => {
    mockGet.mockResolvedValue({ ok: true, status: 200, json: async () => live });

    const mod = await load();
    let clock = 1_000_000;
    mod.__setPortfolioClock(() => clock);

    await mod.fetchPortfolioResilient();
    clock += 61_000; // past the window
    const fresh = await mod.fetchPortfolioResilient();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(fresh.source).toBe('live');
  });

  it('the committed snapshot matches the shape consumers destructure', async () => {
    const { default: fallback } = await import('./portfolio.fallback.json');

    for (const p of fallback.projects) {
      expect(p).toHaveProperty('slug');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('descriptionHtml');
      expect(p).toHaveProperty('heroImageUrl');
    }
    for (const e of fallback.experiences) {
      expect(e).toHaveProperty('company');
      expect(e).toHaveProperty('role');
      expect(e).toHaveProperty('summaryHtml');
      expect(e).toHaveProperty('startedAt');
    }
  });
});
