/**
 * ImmersiveProjectsGallery — Phase 6 showpiece component.
 *
 * Replaces ProjectsIsland.tsx (kept for backward compat; Phase 7 will swap usage).
 *
 * Three render branches (detected at runtime via matchMedia):
 *
 * - FULL (desktop, fine pointer, motion OK):
 *   8 full-viewport sections, ScrollTrigger pinned + scrubbed via createGalleryScrubTimeline,
 *   Lenis bridge enabled (ADR-21, REQ-GALLERY-7).
 *
 * - REDUCED-MOTION (prefers-reduced-motion: reduce):
 *   Static 3-col card grid. Same data, no pin, no scrub (REQ-GALLERY-5).
 *
 * - MOBILE (pointer: coarse):
 *   Vertical scroll-snap layout (REQ-GALLERY-6). No pin, no Lenis (ADR-12).
 *
 * Per-section layout: large project name (display heading), gradient placeholder
 * (gradientFromSlug from Phase 1), summary, tech chips (Badge ghost), links.
 *
 * View Transitions: astro:before-swap → kill triggers + cleanup.
 * Data attributes: data-portfolio-project-card preserved for backward compat.
 *
 * Design §9, REQ-GALLERY-1 through REQ-GALLERY-7, ADR-21, ADR-22.
 */

import { createGalleryScrubTimeline, initLenis } from '@jcsoftdev/animations';
import { useEffect, useRef, useState } from 'react';
import { gradientFromSlug } from '../../lib/gradient-from-slug.js';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  projects: PublicProject[];
}

type RenderMode = 'full' | 'mobile' | 'reduced';

// ---------------------------------------------------------------------------
// Gradient placeholder (inline — avoids Astro component import into .tsx)
// ---------------------------------------------------------------------------

function GradientPlaceholder({ slug }: { slug: string }) {
  const bg = gradientFromSlug(slug);
  return (
    <div
      data-gradient-placeholder
      className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-2xl)] border border-[color:var(--color-border)]"
      style={{ backgroundImage: bg }}
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Per-section layout (full branch)
// ---------------------------------------------------------------------------

function GallerySection({ project, index }: { project: PublicProject; index: number }) {
  const eyebrow = String(index + 1).padStart(2, '0');

  return (
    <section
      data-gallery-section
      data-portfolio-project-card={true}
      className="relative flex min-h-[100svh] w-full items-center overflow-hidden"
      aria-label={project.name}
    >
      {/* Content grid: left text + right visual */}
      <div className="mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 items-center gap-12 px-[var(--container-px)] py-16 md:grid-cols-2">
        {/* Text side */}
        <div className="flex flex-col gap-6">
          <span className="font-mono text-sm text-[color:var(--color-accent)]" aria-hidden>
            {eyebrow}
          </span>

          <h2 className="font-display text-[length:var(--text-5xl)] font-bold leading-[var(--leading-tight)] tracking-[var(--tracking-tighter)] text-[color:var(--color-text-primary)]">
            {project.name}
          </h2>

          <p className="max-w-[40ch] text-[length:var(--text-lg)] leading-[var(--leading-relaxed)] text-[color:var(--color-text-secondary)]">
            {project.summary}
          </p>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-[color:var(--color-accent)] underline underline-offset-4 hover:text-[color:var(--color-accent-hover)]"
                aria-label={`Repo for ${project.name}`}
              >
                Repo →
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-[color:var(--color-text-secondary)] underline underline-offset-4 hover:text-[color:var(--color-text-primary)]"
                aria-label={`Live demo for ${project.name}`}
              >
                Live →
              </a>
            )}
          </div>
        </div>

        {/* Visual side — gradient placeholder */}
        <GradientPlaceholder slug={project.slug} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Static card (reduced-motion + mobile shared card shape)
// ---------------------------------------------------------------------------

function ProjectCard({ project }: { project: PublicProject }) {
  return (
    <article
      data-portfolio-project-card={true}
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-[color:var(--color-accent-muted)] hover:shadow-[var(--shadow-glow-accent)]"
    >
      <GradientPlaceholder slug={project.slug} />
      <h3 className="font-display text-[length:var(--text-xl)] font-semibold text-[color:var(--color-text-primary)]">
        {project.name}
      </h3>
      <p className="text-[length:var(--text-sm)] leading-[var(--leading-relaxed)] text-[color:var(--color-text-secondary)]">
        {project.summary}
      </p>
      <div className="mt-auto flex flex-wrap gap-3">
        {project.repoUrl && (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-[color:var(--color-accent)] underline underline-offset-4"
            aria-label={`Repo for ${project.name}`}
          >
            Repo →
          </a>
        )}
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-[color:var(--color-text-secondary)] underline underline-offset-4"
            aria-label={`Live demo for ${project.name}`}
          >
            Live →
          </a>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Reduced-motion branch — static 3-col grid
// ---------------------------------------------------------------------------

function StaticProjectGrid({ projects }: { projects: PublicProject[] }) {
  return (
    <section
      aria-label="Projects"
      className="mx-auto max-w-[var(--container-max)] px-[var(--container-px)] py-[var(--section-y)]"
    >
      <h2 className="mb-10 font-display text-[length:var(--text-4xl)] font-bold tracking-[var(--tracking-tighter)] text-[color:var(--color-text-primary)]">
        Projects
      </h2>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mobile branch — vertical scroll-snap layout (ADR-12 / REQ-GALLERY-6)
// ---------------------------------------------------------------------------

function ScrollSnapGallery({ projects }: { projects: PublicProject[] }) {
  return (
    <section
      data-scroll-snap-gallery
      aria-label="Projects"
      style={{
        height: '100svh',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {projects.map((project) => (
        <div
          key={project.id}
          style={{ scrollSnapAlign: 'start', minHeight: '100svh' }}
          className="flex flex-col items-center justify-center px-6 py-16"
        >
          <article data-portfolio-project-card={true} className="w-full max-w-lg">
            <GradientPlaceholder slug={project.slug} />
            <div className="mt-6 flex flex-col gap-3">
              <h2 className="font-display text-[length:var(--text-3xl)] font-bold text-[color:var(--color-text-primary)]">
                {project.name}
              </h2>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-[color:var(--color-text-secondary)]">
                {project.summary}
              </p>
              <div className="flex flex-wrap gap-3">
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[color:var(--color-accent)] underline underline-offset-4"
                    aria-label={`Repo for ${project.name}`}
                  >
                    Repo →
                  </a>
                )}
                {project.liveUrl && (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[color:var(--color-text-secondary)] underline underline-offset-4"
                    aria-label={`Live demo for ${project.name}`}
                  >
                    Live →
                  </a>
                )}
              </div>
            </div>
          </article>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function ImmersiveProjectsGallery({ projects }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<RenderMode>('full');

  useEffect(() => {
    // Detect render mode at mount (static check — not reactive)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const m: RenderMode = reduced ? 'reduced' : coarse ? 'mobile' : 'full';
    setMode(m);

    if (m !== 'full' || !rootRef.current) return;

    // Full mode: Lenis bridge + gallery scrub triggers
    const lenis = initLenis({ withScrollTriggerBridge: true });
    const tl = createGalleryScrubTimeline(rootRef.current);

    // View Transitions: kill triggers before page swap to avoid GSAP state leak
    const onBeforeSwap = () => {
      tl.kill();
      lenis?.destroy();
    };
    document.addEventListener('astro:before-swap', onBeforeSwap);

    return () => {
      document.removeEventListener('astro:before-swap', onBeforeSwap);
      tl.kill();
      lenis?.destroy();
    };
  }, []);

  // Reduced-motion: static grid
  if (mode === 'reduced') {
    return <StaticProjectGrid projects={projects} />;
  }

  // Mobile: vertical scroll-snap
  if (mode === 'mobile') {
    return <ScrollSnapGallery projects={projects} />;
  }

  // Full: pinned scrollytelling gallery
  return (
    <div ref={rootRef} data-gallery-root className="relative">
      {projects.map((project, i) => (
        <GallerySection key={project.id} project={project} index={i} />
      ))}
    </div>
  );
}

export default ImmersiveProjectsGallery;
