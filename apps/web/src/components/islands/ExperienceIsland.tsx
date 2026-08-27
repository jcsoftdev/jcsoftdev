/**
 * ExperienceIsland — roles as ruled rows.
 *
 * Three columns: period, company + role, then scope. The rows are separated by
 * hairlines rather than wrapped in cards, because the rail layout already
 * supplies the page's chrome and a second frame around every role just adds
 * noise.
 *
 * Page section header lives in index.astro; this component renders ONLY the list.
 *
 * Reveal is handled by the page's CSS IntersectionObserver, so this island no
 * longer pulls in GSAP or ScrollTrigger.
 */

import type { PublicExperience } from '../../lib/portfolio-fetch.js';

interface ExperienceIslandProps {
  experiences: PublicExperience[];
}

/**
 * Tech stack hardcoded per role (no schema column for it yet).
 *
 * Keyed by `company|role`, not by company alone: two Globant rows would
 * otherwise collide and the frontend role would inherit the full-stack chips.
 */
const roleKey = (company: string, role: string) => `${company}|${role}`;

const TECH_BY_ROLE: Record<string, string[]> = {
  'GlobalLogic|Senior Software Engineer': [
    'Go',
    'TypeScript',
    'Next.js',
    'NestJS',
    'gRPC',
    'Postgres',
    'AWS',
    'Azure',
  ],
  'Globant|Full-Stack Developer': ['React', 'Next.js', 'Node.js', 'DynamoDB', 'AWS Lambda'],
  'Globant|Frontend Developer': ['React', 'GTM', 'AWS Lambda', 'WCAG'],
  'IDW|Frontend Developer': ['React', 'TypeScript', 'Vite', 'Redux', 'AWS S3 / CloudFront'],
  'Peru Software S.A.C|Full-Stack Developer': [
    'React',
    'Node.js',
    'MongoDB',
    'WebSockets',
    'GCP Cloud Run',
  ],
};

/**
 * One measurable outcome per role — the line that separates a senior CV from a
 * job list. Deliberately EMPTY: the figures the CV does claim (76% response-time
 * cut, 80%+ coverage) already sit in the role summaries, and repeating one here
 * reads as padding. Add an entry and the row renders a Result line.
 *
 * Shape: 'Company|Role': 'Cut p95 checkout latency from 900ms to 220ms.'
 */
const RESULT_BY_ROLE: Record<string, string> = {};

/** Brand color hint per role (subtle accent on monogram). */
const ROLE_HUE: Record<string, string> = {
  'GlobalLogic|Senior Software Engineer': 'oklch(0.70 0.15 30)', // orange
  'Globant|Full-Stack Developer': 'oklch(0.70 0.15 145)', // green
  'Globant|Frontend Developer': 'oklch(0.70 0.15 175)', // teal
  'IDW|Frontend Developer': 'oklch(0.70 0.15 250)', // blue
  'Peru Software S.A.C|Full-Stack Developer': 'oklch(0.70 0.15 70)', // amber
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

function year(iso: string | null): string | null {
  if (!iso) return null;
  const y = new Date(`${iso}T00:00:00`).getFullYear();
  return Number.isNaN(y) ? null : y.toString();
}

/**
 * "2025 —" for a current role, "2023 — 25" for a closed one.
 *
 * Rendered as real <time> elements rather than a formatted string so the dates
 * stay machine-readable — the résumé page and any future JSON-LD read the same
 * markup.
 */
function Period({ startedAt, endedAt }: { startedAt: string; endedAt: string | null }) {
  const from = year(startedAt);
  const to = year(endedAt);

  return (
    <span className="font-mono text-xs text-[color:var(--color-text-muted)]">
      <time dateTime={startedAt}>{from ?? '—'}</time>
      {endedAt === null ? (
        ' —'
      ) : from === to ? null : (
        <>
          {' — '}
          <time dateTime={endedAt}>{to?.slice(2) ?? '—'}</time>
        </>
      )}
    </span>
  );
}

export function ExperienceIsland({ experiences }: ExperienceIslandProps) {
  const sorted = [...experiences].sort((a, b) => {
    const da = a.displayOrder ?? Number.POSITIVE_INFINITY;
    const db = b.displayOrder ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return b.startedAt.localeCompare(a.startedAt);
  });

  if (sorted.length === 0) {
    return (
      <p className="font-mono text-sm text-[color:var(--color-text-muted)]">
        No roles to show yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {sorted.map((exp) => {
        const isCurrent = exp.endedAt === null;
        const key = roleKey(exp.company, exp.role);
        const tech = TECH_BY_ROLE[key] ?? [];
        const result = RESULT_BY_ROLE[key];
        const hue = ROLE_HUE[key] ?? 'var(--color-border-strong)';

        return (
          <li
            key={exp.id}
            data-portfolio-experience-card
            data-current={String(isCurrent)}
            className={[
              'grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[color:var(--color-border-soft)] px-3 py-6 @4xl:grid-cols-[112px_200px_minmax(0,1fr)] @4xl:px-0',
              isCurrent
                ? 'bg-[color:var(--color-surface)] shadow-[inset_2px_0_0_0_var(--color-accent)]'
                : '',
            ].join(' ')}
          >
            {/* Period */}
            <div className="flex flex-col gap-2 @4xl:pl-3">
              <Period startedAt={exp.startedAt} endedAt={exp.endedAt} />
              {isCurrent && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-[color:var(--color-accent)]">
                  <span
                    aria-hidden="true"
                    className="inline-block h-1 w-1 rounded-full bg-[color:var(--color-accent)]"
                  />
                  Now
                </span>
              )}
            </div>

            {/* Company + role */}
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border font-mono text-[11px] font-semibold"
                style={{ borderColor: hue, color: hue }}
              >
                {monogram(exp.company)}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-lg font-semibold leading-tight tracking-tight text-[color:var(--color-text-primary)]">
                  {exp.company}
                </span>
                <span className="font-mono text-xs text-[color:var(--color-text-secondary)]">
                  {exp.role}
                </span>
                {exp.location && (
                  <span className="font-mono text-[11px] text-[color:var(--color-text-faint)]">
                    {exp.location}
                  </span>
                )}
              </span>
            </div>

            {/* Scope */}
            <div className="flex flex-col gap-3">
              {exp.summaryHtml && (
                // Sanitized server-side by isomorphic-dompurify (ADR-14).
                <div
                  className="max-w-[62ch] space-y-2 text-sm leading-relaxed text-[color:var(--color-text-secondary)] [&_a]:text-[color:var(--color-text-primary)] [&_a]:underline [&_code]:font-mono [&_em]:not-italic [&_em]:text-[color:var(--color-text-primary)] [&_li]:pl-1 [&_li::marker]:text-[color:var(--color-text-faint)] [&_strong]:font-medium [&_strong]:text-[color:var(--color-text-primary)] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: exp.summaryHtml }}
                />
              )}

              {result && (
                <p className="flex flex-wrap items-baseline gap-2.5 text-sm leading-relaxed">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-success)]">
                    Result
                  </span>
                  <span className="text-[color:var(--color-text-primary)]">{result}</span>
                </p>
              )}

              {tech.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {tech.map((t) => (
                    <li
                      key={t}
                      className="rounded-xs border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-text-muted)]"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}

      <li aria-hidden="true" className="border-t border-[color:var(--color-border)]" />
    </ol>
  );
}
