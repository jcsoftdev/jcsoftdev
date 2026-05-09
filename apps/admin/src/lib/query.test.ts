/**
 * Tests for QueryClient setup and query key factory.
 * TDD RED phase.
 */
import { describe, expect, it } from 'vitest';

describe('queryClient', () => {
  it('exports a queryClient instance', async () => {
    const { queryClient } = await import('./query.js');
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getQueryData).toBe('function');
  });

  it('queryClient has staleTime configured (not 0)', async () => {
    const { queryClient } = await import('./query.js');
    const defaults = queryClient.getDefaultOptions();
    // Sensible default: staleTime should be > 0 for admin (prevents excessive refetches)
    expect(defaults.queries?.staleTime ?? 0).toBeGreaterThan(0);
  });
});

describe('queryKeys', () => {
  it('exports a queryKeys factory', async () => {
    const { queryKeys } = await import('./query.js');
    expect(queryKeys).toBeDefined();
  });

  it('queryKeys.posts.all produces stable array', async () => {
    const { queryKeys } = await import('./query.js');
    expect(queryKeys.posts.all).toEqual(['posts']);
  });

  it('queryKeys.posts.list with params produces stable array', async () => {
    const { queryKeys } = await import('./query.js');
    const params = { status: 'draft', page: 1 };
    const key = queryKeys.posts.list(params);
    expect(key).toEqual(['posts', 'list', params]);
  });

  it('queryKeys.posts.detail produces stable array', async () => {
    const { queryKeys } = await import('./query.js');
    const key = queryKeys.posts.detail('post-id-123');
    expect(key).toEqual(['posts', 'detail', 'post-id-123']);
  });
});
