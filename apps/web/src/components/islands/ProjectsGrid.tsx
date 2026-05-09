/**
 * ProjectsGrid — clean 3-col grid of all projects.
 *
 * Replaces ImmersiveProjectsGallery on the home page. Each card has:
 * - Slug-hash gradient placeholder w/ monogram
 * - Number + name + summary
 * - Hover lift + accent border
 * - Optional repoUrl / liveUrl
 *
 * Reveal: createSectionRevealTimeline staggered per card on viewport entry.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';
import { gradientFromSlug } from '../../lib/gradient-from-slug.js';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

gsap.registerPlugin(ScrollTrigger);

interface ProjectsGridProps {
  projects: PublicProject[];
}

/** Attach 3D tilt + shine following cursor to all cards inside a root. */
function attachCardTilt(root: HTMLElement): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduced || coarse) return () => {};

  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-tilt-card]'));
  const cleanups: Array<() => void> = [];

  for (const card of cards) {
    let raf = 0;
    const target = { rx: 0, ry: 0, mx: 50, my: 50 };
    const current = { rx: 0, ry: 0, mx: 50, my: 50 };

    const onMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      target.ry = (px - 0.5) * 8; // rotateY (left-right tilt)
      target.rx = -(py - 0.5) * 8; // rotateX (up-down)
      target.mx = px * 100;
      target.my = py * 100;
    };
    const onLeave = () => {
      target.rx = 0;
      target.ry = 0;
    };

    const tick = () => {
      current.rx += (target.rx - current.rx) * 0.12;
      current.ry += (target.ry - current.ry) * 0.12;
      current.mx += (target.mx - current.mx) * 0.18;
      current.my += (target.my - current.my) * 0.18;
      card.style.transform = `perspective(1000px) rotateX(${current.rx}deg) rotateY(${current.ry}deg) translate3d(0,0,0)`;
      card.style.setProperty('--tilt-mx', `${current.mx}%`);
      card.style.setProperty('--tilt-my', `${current.my}%`);
      raf = requestAnimationFrame(tick);
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    cleanups.push(() => {
      cancelAnimationFrame(raf);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
      card.style.transform = '';
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

function monogram(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatYear(iso: string): string {
  return new Date(`${iso}T00:00:00`).getFullYear().toString();
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cards = Array.from(rootRef.current.querySelectorAll<HTMLElement>('[data-tilt-card]'));

    let tween: gsap.core.Tween | null = null;
    if (!reduced && cards.length > 0) {
      // Set initial state explicitly so cards aren't visible before reveal
      gsap.set(cards, { y: 60, opacity: 0 });
      tween = gsap.to(cards, {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 85%',
          once: true,
        },
      });
    }

    const detachTilt = attachCardTilt(rootRef.current);
    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      detachTilt();
    };
  }, []);

  // Sort: featured first by featuredOrder, then non-featured by startedAt desc
  const sorted = [...projects].sort((a, b) => {
    const fa = a.featuredOrder ?? 999;
    const fb = b.featuredOrder ?? 999;
    if (fa !== fb) return fa - fb;
    return b.startedAt.localeCompare(a.startedAt);
  });

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1280px] px-6 lg:px-12" data-section-content>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((project, i) => {
          const isFeatured = project.featuredOrder !== null;
          const externalHref = project.liveUrl ?? project.repoUrl ?? null;
          const Wrapper = externalHref ? 'a' : 'div';

          return (
            <Wrapper
              key={project.id}
              {...(externalHref
                ? {
                    href: externalHref,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {})}
              data-tilt-card
              className={[
                'group relative flex flex-col overflow-hidden rounded-xl border bg-[color:var(--color-surface)]',
                'transition-[background-color,border-color,box-shadow,transform] duration-[var(--duration-base)] [transition-timing-function:var(--ease-out-expo)]',
                'hover:bg-[color:var(--color-surface-elevated)]',
                'hover:[box-shadow:0_24px_48px_-24px_oklch(0.74_0.16_280_/_0.35)]',
                'active:scale-[0.985]',
                'will-change-transform [transform-style:preserve-3d]',
                isFeatured
                  ? 'border-[color:var(--color-border)] hover:border-[color:var(--color-accent-muted)]'
                  : 'border-[color:var(--color-border-soft)] hover:border-[color:var(--color-border)]',
              ].join(' ')}
            >
              {/* Shine overlay following cursor */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[var(--duration-base)] group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(circle at var(--tilt-mx, 50%) var(--tilt-my, 50%), oklch(0.74 0.16 280 / 0.18), transparent 35%)',
                  zIndex: 1,
                }}
              />
              {/* Gradient hero w/ monogram */}
              <div
                aria-hidden="true"
                className="relative aspect-[16/10] w-full overflow-hidden"
                style={{ background: gradientFromSlug(project.slug) }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, transparent, oklch(0 0 0 / 0.45) 80%)',
                  }}
                >
                  <span
                    className="font-display text-7xl font-bold text-white/80 mix-blend-overlay"
                    style={{
                      letterSpacing: '-0.04em',
                      textShadow: '0 4px 16px oklch(0 0 0 / 0.5)',
                    }}
                  >
                    {monogram(project.name)}
                  </span>
                </div>
                {/* Featured ribbon */}
                {isFeatured && (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 backdrop-blur-md">
                    <span
                      aria-hidden="true"
                      className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-accent)]"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/90">
                      Featured
                    </span>
                  </div>
                )}
                {/* External arrow */}
                {externalHref && (
                  <div
                    aria-hidden="true"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 font-mono text-sm text-white/70 backdrop-blur-md transition-all duration-[var(--duration-base)] group-hover:border-[color:var(--color-accent)] group-hover:text-[color:var(--color-accent)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    ↗
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                    0{i + 1}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                    {formatYear(project.startedAt)}
                    {project.endedAt && ` – ${formatYear(project.endedAt)}`}
                  </span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-[color:var(--color-text-primary)] transition-colors group-hover:text-[color:var(--color-accent)]">
                  {project.name}
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
                  {project.summary}
                </p>

                {/* Footer row */}
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-[color:var(--color-border-soft)]">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-accent)] transition-colors">
                    {externalHref ? 'Visit' : 'Case'}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-[color:var(--color-text-muted)] transition-all group-hover:text-[color:var(--color-accent)] group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectsGrid;
