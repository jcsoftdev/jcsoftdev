/**
 * ExperienceIsland — clean CV-style list.
 *
 * Two-column layout: dates+company on left, role+summary on right.
 * Horizontal rule between entries. No centered timeline gimmick — the
 * left column IS the timeline (mono dates anchor each row).
 *
 * Page section header lives in index.astro; this component renders ONLY the list.
 *
 * Animation: createExperienceFadeUpTimeline factory (reduced-motion safe via
 * createReducedMotionSafe wrapper in @jcsoftdev/animations).
 */

import { createExperienceFadeUpTimeline } from '@jcsoftdev/animations';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef } from 'react';
import type { PublicExperience } from '../../lib/portfolio-fetch.js';

gsap.registerPlugin(ScrollTrigger);

interface ExperienceIslandProps {
  experiences: PublicExperience[];
}

/** Tech stack hardcoded per company (no schema column for it yet). */
const TECH_BY_COMPANY: Record<string, string[]> = {
  Pulzifi: ['Go', 'Hono', 'Next.js 16', 'Postgres', 'Redis', 'Docker'],
  Travitur: ['NestJS 11', 'Prisma', 'Postgres', 'Expo', 'React Native', 'TypeScript'],
  GlobalLogic: ['Go', 'Node.js', 'NestJS', 'gRPC', 'Azure', 'AWS Lambda', 'Kafka'],
  DD3: ['React', 'Next.js', 'NestJS', 'Redis', 'Postgres', 'AWS'],
  Globant: ['React', 'Next.js', 'Node.js', 'DynamoDB', 'AWS Lambda'],
  IDW: ['React', 'TypeScript', 'Vite', 'Redux', 'AWS S3 / CloudFront'],
  'Peru Software S.A.C': ['React', 'Node.js', 'MongoDB', 'WebSockets', 'GCP Cloud Run'],
};

/** Brand color hint per company (subtle accent on monogram). */
const COMPANY_HUE: Record<string, string> = {
  Pulzifi: 'oklch(0.70 0.20 249)', // circuit blue (site brand)
  Travitur: 'oklch(0.70 0.15 200)', // teal
  GlobalLogic: 'oklch(0.70 0.15 30)', // orange
  DD3: 'oklch(0.70 0.18 350)', // pink
  Globant: 'oklch(0.70 0.15 145)', // green
  IDW: 'oklch(0.70 0.15 250)', // blue
  'Peru Software S.A.C': 'oklch(0.70 0.15 70)', // amber
};

function monogram(company: string): string {
  return company
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ExperienceIsland({ experiences }: ExperienceIslandProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const timeline = createExperienceFadeUpTimeline(rootRef.current);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rows = Array.from(
      rootRef.current.querySelectorAll<HTMLElement>('[data-portfolio-experience-card]')
    );

    let tween: gsap.core.Tween | null = null;
    if (!reduced && rows.length > 0) {
      gsap.set(rows, { y: 30, opacity: 0, filter: 'blur(6px)' });
      tween = gsap.to(rows, {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: {
          trigger: rootRef.current,
          start: 'top 80%',
          once: true,
        },
      });
    }

    return () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      timeline.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1280px] px-6 lg:px-12">
      <ol className="flex flex-col">
        {experiences.map((exp, index) => {
          const isCurrent = exp.endedAt === null;
          return (
            <li
              key={exp.id}
              data-current={isCurrent}
              // biome-ignore lint/suspicious/noExplicitAny: data-* attribute
              {...({ 'data-portfolio-experience-card': true } as any)}
              className={[
                'group relative grid grid-cols-1 gap-y-3 gap-x-12 py-10 lg:grid-cols-12 lg:py-12',
                'transition-[padding] duration-[var(--duration-base)] [transition-timing-function:var(--ease-out-expo)]',
                'hover:lg:pl-6',
                index < experiences.length - 1
                  ? 'border-b border-[color:var(--color-border-soft)]'
                  : '',
              ].join(' ')}
            >
              {/* Left edge accent — appears on hover, equal treatment for all rows */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-6 left-0 w-[2px] origin-top scale-y-0 bg-[color:var(--color-accent)] opacity-0 transition-transform duration-[var(--duration-base)] [transition-timing-function:var(--ease-out-expo)] group-hover:scale-y-100 group-hover:opacity-100"
              />

              {/* Left column — monogram + dates + company */}
              <div className="lg:col-span-4">
                <div className="flex items-start gap-4">
                  {/* Monogram badge */}
                  <div
                    aria-hidden="true"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] font-mono text-sm font-semibold transition-colors duration-[var(--duration-base)] group-hover:border-[color:var(--color-accent-muted)]"
                    style={{
                      color: COMPANY_HUE[exp.company] ?? 'var(--color-text-secondary)',
                    }}
                  >
                    {monogram(exp.company)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                      <time dateTime={exp.startedAt}>{formatDate(exp.startedAt)}</time>
                      <span aria-hidden="true">→</span>
                      {exp.endedAt ? (
                        <time dateTime={exp.endedAt}>{formatDate(exp.endedAt)}</time>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] px-2 py-0.5 text-[color:var(--color-accent)] [box-shadow:0_0_12px_oklch(0.74_0.16_280_/_0.25)]">
                          <span
                            aria-hidden="true"
                            className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-accent)] animate-pulse"
                          />
                          Now
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-[26px] font-semibold leading-[1.05] tracking-tight text-[color:var(--color-text-primary)] transition-colors duration-[var(--duration-fast)] group-hover:text-[color:var(--color-accent)]">
                      {exp.company}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Right column — role + summary + tech chips + hover arrow */}
              <div className="lg:col-span-8 relative">
                <p className="font-mono text-sm text-[color:var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] group-hover:text-[color:var(--color-accent)]">
                  {exp.role}
                </p>
                {exp.summaryHtml && (
                  <div
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized server-side per ADR-14
                    dangerouslySetInnerHTML={{ __html: exp.summaryHtml }}
                    className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-[color:var(--color-text-secondary)] [&_a]:text-[color:var(--color-text-primary)] [&_a]:underline [&_code]:font-mono [&_em]:not-italic [&_em]:text-[color:var(--color-text-primary)]"
                  />
                )}
                {/* Tech chips */}
                {TECH_BY_COMPANY[exp.company] && (
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {TECH_BY_COMPANY[exp.company].map((tech) => (
                      <li
                        key={tech}
                        className="rounded border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]/60 px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)] transition-colors group-hover:border-[color:var(--color-border)] group-hover:text-[color:var(--color-text-secondary)]"
                      >
                        {tech}
                      </li>
                    ))}
                  </ul>
                )}
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 font-mono text-xs text-[color:var(--color-text-muted)] opacity-0 transition-all duration-[var(--duration-base)] group-hover:opacity-100 group-hover:translate-x-1"
                >
                  ↗
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
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

export default ExperienceIsland;
