/**
 * ProjectsIsland — React 19 island for the Projects section.
 *
 * Receives pre-fetched projects from Astro SSR frontmatter.
 * On mount, runs createProjectsStaggerTimeline (scroll-triggered stagger fade).
 * On unmount, calls timeline.kill() to clean up GSAP + ScrollTrigger.
 *
 * Hero images: raw <img loading="lazy" decoding="async"> per spec REQ-PAGE-5.
 * Astro <Image /> not used in this change.
 * Description: rendered as sanitized HTML via dangerouslySetInnerHTML
 * (safe — sanitized server-side at API serialization time by isomorphic-dompurify).
 *
 * Design §9, §12 — client:visible directive (below-fold, Astro intersection observer).
 */

import { createProjectsStaggerTimeline } from '@jcsoftdev/animations';
import { useEffect, useRef } from 'react';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

interface ProjectsIslandProps {
  projects: PublicProject[];
}

export function ProjectsIsland({ projects }: ProjectsIslandProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;

    const timeline = createProjectsStaggerTimeline(rootRef.current);

    return () => {
      timeline.kill();
    };
  }, []);

  return (
    <section ref={rootRef} aria-label="Projects" className="mx-auto max-w-4xl px-4 py-16">
      <h2 className="mb-10 text-3xl font-bold tracking-tight">Projects</h2>

      <div className="grid gap-8 sm:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.id}
            // biome-ignore lint/suspicious/noExplicitAny: data attribute — valid HTML5 data-* attribute
            {...({ 'data-portfolio-project-card': true } as any)}
            className="flex flex-col rounded-lg border border-gray-200 overflow-hidden"
          >
            {project.heroImageUrl && (
              <img
                src={project.heroImageUrl}
                alt={project.name}
                loading="lazy"
                decoding="async"
                className="h-48 w-full object-cover"
              />
            )}

            <div className="flex flex-1 flex-col p-6">
              <h3 className="mb-2 text-xl font-semibold">{project.name}</h3>

              <p className="mb-4 text-sm leading-relaxed text-gray-600">{project.summary}</p>

              {project.descriptionHtml && (
                <div
                  dangerouslySetInnerHTML={{ __html: project.descriptionHtml }}
                  className="prose prose-sm mb-4 max-w-none text-gray-700"
                />
              )}

              <div className="mb-4 flex flex-wrap gap-2 text-sm text-gray-400">
                <time dateTime={project.startedAt}>{formatDate(project.startedAt)}</time>
                {project.endedAt && (
                  <>
                    <span>&ndash;</span>
                    <time dateTime={project.endedAt}>{formatDate(project.endedAt)}</time>
                  </>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline"
                    aria-label={`Repo: ${project.name}`}
                  >
                    Repo
                  </a>
                )}
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-green-600 hover:underline"
                    aria-label={`Live: ${project.name}`}
                  >
                    Live
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

export default ProjectsIsland;
