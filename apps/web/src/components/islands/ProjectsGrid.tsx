/**
 * ProjectsGrid — projects as a readout table.
 *
 * The card grid was three tiles of chrome around one sentence each. A table
 * puts every project's name and summary on one scan line, which is how
 * someone actually reads a portfolio: down the names first, then across the one
 * that catches them.
 *
 * The slug-hash gradient survives as a monogram chip so projects stay visually
 * identifiable, and the featured project keeps an accent rail.
 *
 * Two columns are deliberately absent: Stack and Result. `PublicProject` has no
 * field for either, and inventing them would be worse than omitting them. Both
 * are a column away once the API serializes them.
 */

import { gradientFromSlug } from '../../lib/gradient-from-slug.js';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

interface ProjectsGridProps {
  projects: PublicProject[];
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

/** Column layout is driven by the container, so the table only appears when
 *  the column can actually hold five columns. */
const GRID =
  'grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_28px] @3xl:items-start @3xl:gap-x-5 @3xl:gap-y-0';

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  const sorted = [...projects].sort((a, b) => {
    const fa = a.featuredOrder ?? Number.POSITIVE_INFINITY;
    const fb = b.featuredOrder ?? Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    return (b.startedAt ?? '').localeCompare(a.startedAt ?? '');
  });

  if (sorted.length === 0) {
    return (
      <p className="font-mono text-sm text-[color:var(--color-text-muted)]">
        No projects to show yet.
      </p>
    );
  }

  return (
    <div>
      {/* Column header. Hidden on small screens, where each row stacks. */}
      <div
        aria-hidden="true"
        className={`${GRID} hidden border-t border-[color:var(--color-border)] py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-faint)] @3xl:grid`}
      >
        <span>Project</span>
        <span>What it does</span>
        <span />
      </div>

      <ul className="flex flex-col">
        {sorted.map((project) => {
          const href = project.liveUrl ?? project.repoUrl ?? null;
          const isFeatured = project.featuredOrder !== null;
          const external = Boolean(href);

          const Row = href ? 'a' : 'div';

          return (
            <li key={project.id}>
              <Row
                {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={[
                  GRID,
                  'group border-t border-[color:var(--color-border-soft)] px-3 py-4 outline-none transition-colors duration-[var(--duration-fast)] @3xl:px-0 @3xl:py-4',
                  'hover:bg-[color:var(--color-surface)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]',
                  isFeatured
                    ? 'bg-[color:var(--color-surface)] shadow-[inset_2px_0_0_0_var(--color-accent)]'
                    : '',
                ].join(' ')}
              >
                {/* Project — monogram chip keeps the slug gradient alive */}
                <span className="flex min-w-0 items-center gap-3 @3xl:pl-3">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm font-display text-[11px] font-bold text-white/85"
                    style={{
                      background: gradientFromSlug(project.slug),
                      textShadow: '0 1px 4px oklch(0 0 0 / 0.5)',
                    }}
                  >
                    {monogram(project.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={[
                        'font-display text-base font-semibold leading-tight tracking-tight transition-colors @3xl:text-lg',
                        isFeatured
                          ? 'text-[color:var(--color-accent)]'
                          : 'text-[color:var(--color-text-primary)] group-hover:text-[color:var(--color-accent)]',
                      ].join(' ')}
                    >
                      {project.name}
                    </span>
                    {isFeatured && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                        Featured
                      </span>
                    )}
                  </span>
                </span>

                {/* Summary */}
                <span className="order-3 col-span-2 mt-1 text-sm leading-relaxed text-[color:var(--color-text-secondary)] @3xl:order-none @3xl:col-span-1 @3xl:mt-0">
                  {project.summary ?? '—'}
                </span>

                {/* Affordance */}
                <span
                  aria-hidden="true"
                  className="order-4 hidden font-mono text-sm text-[color:var(--color-text-muted)] transition-[color,transform] group-hover:translate-x-1 group-hover:text-[color:var(--color-accent)] @3xl:order-none @3xl:inline"
                >
                  {external ? '↗' : ''}
                </span>
              </Row>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[color:var(--color-border)]" />
    </div>
  );
}
