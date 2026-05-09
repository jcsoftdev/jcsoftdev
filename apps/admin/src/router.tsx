/**
 * TanStack Router configuration.
 *
 * Design ADR-3: use routerWithQueryClient adapter so that route loaders
 * can access queryClient.ensureQueryData() for prefetching.
 *
 * The router context must include { queryClient } for the adapter to work.
 * QueryClientProvider is in main.tsx (wraps RouterProvider).
 */
import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';
import { queryClient } from './lib/query.js';
import { routeTree } from './routeTree.gen.js';

export const router = routerWithQueryClient(
  createRouter({
    routeTree,
    context: { queryClient },
  }),
  queryClient
);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Export router context type for use in routes
export interface RouterContext {
  queryClient: QueryClient;
}
