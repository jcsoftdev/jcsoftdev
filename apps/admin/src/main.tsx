/**
 * Admin SPA entry point.
 *
 * Design §6 + ADR-3: wrap router with QueryClientProvider via
 * routerWithQueryClient adapter. This enables loaders to use
 * queryClient.ensureQueryData() for prefetching.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from './lib/query.js';
import { router } from './router.js';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
