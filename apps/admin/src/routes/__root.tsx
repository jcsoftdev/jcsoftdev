/**
 * Root route — wraps the entire app.
 * Declares the router context type (includes queryClient for routerWithQueryClient).
 * RouterContext is exported so all route modules can reference it by name.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
