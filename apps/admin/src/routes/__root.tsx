/**
 * Root route — wraps the entire app.
 * Declares the router context type (includes queryClient for routerWithQueryClient).
 * RouterContext is exported so all route modules can reference it by name.
 *
 * Also owns route-change a11y: SPA navigations don't reload the document, so
 * assistive tech gets no signal that the page changed unless we update
 * document.title and move focus ourselves (WCAG 2.4.3 / 2.4.2 for SPAs).
 */
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  useRouteAnnouncer();
  return <Outlet />;
}

const BASE_TITLE = 'jcsoftdev Admin';

const TITLE_RULES: Array<[prefix: string, label: string]> = [
  ['/login/callback', 'Verifying login'],
  ['/login', 'Sign in'],
  ['/dashboard', 'Dashboard'],
  ['/experiences', 'Experiences'],
  ['/projects', 'Projects'],
  ['/posts', 'Posts'],
];

export function titleForPath(pathname: string): string {
  if (pathname === '' || pathname === '/') {
    return BASE_TITLE;
  }
  const rule = TITLE_RULES.find(([prefix]) => pathname.startsWith(prefix));
  return rule ? `${rule[1]} | ${BASE_TITLE}` : BASE_TITLE;
}

/**
 * Updates document.title and moves focus to the page's <main> landmark on
 * every route change, so SPA navigation behaves like a real page load for
 * screen readers.
 */
function useRouteAnnouncer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.title = titleForPath(pathname);

    const target = document.querySelector<HTMLElement>('main');
    if (!target) {
      return;
    }
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus();
  }, [pathname]);
}
