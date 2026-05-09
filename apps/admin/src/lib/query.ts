/**
 * TanStack Query client configuration and query key factory.
 *
 * Design ADR-3: routerWithQueryClient adapter pattern.
 * Single QueryClient instance with sensible defaults for admin SPA.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds — admin data changes infrequently
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Typed query key factory.
 * Using stable key arrays prevents key collisions and simplifies invalidation.
 */
export const queryKeys = {
  posts: {
    all: ['posts'] as const,
    list: (params: Record<string, unknown>) => ['posts', 'list', params] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (params: Record<string, unknown>) => ['projects', 'list', params] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
  },
  experiences: {
    all: ['experiences'] as const,
    list: (params: Record<string, unknown>) => ['experiences', 'list', params] as const,
    detail: (id: string) => ['experiences', 'detail', id] as const,
  },
};
