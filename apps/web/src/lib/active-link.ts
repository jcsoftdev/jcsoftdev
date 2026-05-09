/**
 * isActive — pure helper for nav active-link detection (design §11, ADR-18)
 *
 * Rules:
 *   - '/' matches ONLY '/' (exact; root is never a prefix for other routes)
 *   - '/portfolio' matches '/portfolio' and '/portfolio/*' (prefix)
 *   - '/blog' matches '/blog' and '/blog/*' (prefix)
 *
 * No Astro or browser dependencies — safe to unit-test in Vitest (jsdom).
 */
export function isActive(currentPath: string, linkHref: string): boolean {
  if (linkHref === '/') {
    return currentPath === '/';
  }
  return currentPath === linkHref || currentPath.startsWith(`${linkHref}/`);
}
