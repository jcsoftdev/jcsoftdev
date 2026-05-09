/**
 * SEO helpers — JSON-LD schema builders for structured data.
 *
 * Each builder returns a plain object that conforms to schema.org spec.
 * Pass single objects or arrays to RootLayout's `jsonLd` prop.
 *
 * Reference: https://schema.org/ + Google Search Central structured data docs.
 */

export const SITE_URL = 'https://jcsoftdev.com';
export const SITE_NAME = 'jcsoftdev';
export const AUTHOR_NAME = 'Juan Carlos Valencia';
export const AUTHOR_TWITTER = '@jcsoftdev';
export const AUTHOR_GITHUB = 'https://github.com/jcsoftdev';
export const AUTHOR_LINKEDIN = 'https://linkedin.com/in/jcsoftdev';
export const AUTHOR_EMAIL = 'hello@jcsoftdev.com';

export type JsonLdSchema = Record<string, unknown>;

/** Absolute URL helper — prefixes pathname with SITE_URL. */
export function absoluteUrl(pathname: string): string {
  if (pathname.startsWith('http')) return pathname;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${path}`;
}

/**
 * Person schema — represents the site author. Use on home / about pages.
 * https://schema.org/Person
 */
export function buildPersonSchema(): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/#person`,
    name: AUTHOR_NAME,
    alternateName: SITE_NAME,
    url: SITE_URL,
    image: absoluteUrl('/og-default.png'),
    email: `mailto:${AUTHOR_EMAIL}`,
    jobTitle: 'Senior Full-Stack Developer',
    description:
      'Senior full-stack developer with 9+ years of experience building scalable web applications. Specializes in clean architecture, performance optimization, and end-to-end product engineering.',
    knowsAbout: [
      'TypeScript',
      'Go',
      'React',
      'Next.js',
      'NestJS',
      'Hono',
      'PostgreSQL',
      'AWS',
      'Azure',
      'GCP',
      'Docker',
      'Hexagonal Architecture',
      'Domain-Driven Design',
      'Clean Architecture',
    ],
    sameAs: [AUTHOR_GITHUB, AUTHOR_LINKEDIN],
  };
}

/**
 * WebSite schema — declares the site itself. Add to home page.
 * https://schema.org/WebSite
 */
export function buildWebSiteSchema(): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: 'Personal portfolio and blog of Juan Carlos Valencia.',
    inLanguage: 'en',
    publisher: { '@id': `${SITE_URL}/#person` },
  };
}

/**
 * Blog schema — declares the blog section. Use on /blog.
 * https://schema.org/Blog
 */
export function buildBlogSchema(): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog#blog`,
    url: `${SITE_URL}/blog`,
    name: `${SITE_NAME} — Writing`,
    description: 'Engineering articles, tutorials, and notes on full-stack development.',
    inLanguage: 'en',
    author: { '@id': `${SITE_URL}/#person` },
    publisher: { '@id': `${SITE_URL}/#person` },
  };
}

/**
 * BlogPosting schema — single blog post. Use on /blog/[slug].
 * https://schema.org/BlogPosting
 */
export function buildBlogPostingSchema(post: {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  heroImageUrl: string | null;
}): JsonLdSchema {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.heroImageUrl ?? absoluteUrl('/og-default.png');

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    headline: post.title,
    description: post.excerpt ?? `Read "${post.title}" on ${SITE_NAME}.`,
    image,
    datePublished: post.publishedAt ?? post.updatedAt,
    dateModified: post.updatedAt,
    inLanguage: 'en',
    author: { '@id': `${SITE_URL}/#person` },
    publisher: { '@id': `${SITE_URL}/#person` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': `${SITE_URL}/blog#blog` },
  };
}

/**
 * BreadcrumbList schema — site navigation hierarchy.
 * https://schema.org/BreadcrumbList
 */
export function buildBreadcrumbSchema(items: Array<{ name: string; url: string }>): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : absoluteUrl(item.url),
    })),
  };
}
