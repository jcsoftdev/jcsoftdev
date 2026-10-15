/**
 * ProjectsGrid — projects as an expandable readout table.
 *
 * Every row is a disclosure: the name and one-line summary stay on the scan
 * line, and the row opens inline to the longer description, the period and the
 * live/source links that exist. Rows without a link used to be dead dividers;
 * now every row has something behind it. Rows open independently, and the panel
 * is toggled with `hidden` rather than animated, so nothing moves under
 * reduced-motion.
 *
 * A flat monogram chip keeps projects visually identifiable. The first three featured rows get a larger treatment.
 *
 * Stack is deliberately absent: `PublicProject` has no field for it, and
 * inventing one would be worse than omitting it.
 */

import { useId, useState } from 'react';
import type { PublicProject } from '../../lib/portfolio-fetch.js';
import { projectPeriod } from '../../lib/project-period.js';

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

const FEATURED_LARGE = 3;

const PANEL_LINK =
  'inline-flex items-center gap-1.5 rounded-sm font-mono text-xs uppercase tracking-[0.12em] text-[color:var(--color-accent)] outline-none transition-colors hover:text-[color:var(--color-accent-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]';

function ProjectRow({
  project,
  large,
  open,
  onToggle,
}: {
  project: PublicProject;
  large: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const isFeatured = project.featuredOrder !== null;
  const period = projectPeriod(project.startedAt, project.endedAt);

  return (
    <li className="border-t border-[color:var(--color-border-soft)]">
      <div
        className={[
          GRID,
          'group relative px-3 transition-colors duration-[var(--duration-fast)] @3xl:px-0',
          large ? 'py-6 @3xl:py-7' : 'py-4',
          'hover:bg-[color:var(--color-surface)]',
          isFeatured || open
            ? 'bg-[color:var(--color-surface)] shadow-[inset_2px_0_0_0_var(--color-accent)]'
            : '',
        ].join(' ')}
      >
        {/* Project — the button owns the whole row via a stretched pseudo-element */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="order-1 flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[color:var(--color-accent)] @3xl:order-none @3xl:pl-3"
        >
          <span
            aria-hidden="true"
            className={[
              'flex shrink-0 items-center justify-center rounded-sm border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface-elevated)] font-display font-bold text-[color:var(--color-text-secondary)]',
              large ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[11px]',
            ].join(' ')}
          >
            {monogram(project.name)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={[
                'font-display font-semibold leading-tight tracking-tight transition-colors',
                large ? 'text-xl @3xl:text-2xl' : 'text-base @3xl:text-lg',
                'text-[color:var(--color-text-primary)]',
              ].join(' ')}
            >
              {project.name}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
              {isFeatured && <span>Featured</span>}
              {period && (
                <span className="normal-case tracking-normal text-[color:var(--color-text-faint)]">
                  {period}
                </span>
              )}
            </span>
          </span>
        </button>

        {/* Summary */}
        <p
          className={[
            'order-3 col-span-2 mt-1 leading-relaxed text-[color:var(--color-text-secondary)] @3xl:order-none @3xl:col-span-1 @3xl:mt-0',
            large ? 'text-base' : 'text-sm',
          ].join(' ')}
        >
          {project.summary ?? '—'}
        </p>

        {/* Affordance */}
        <span
          aria-hidden="true"
          className="order-2 pointer-events-none justify-self-end font-mono text-base text-[color:var(--color-text-muted)] transition-colors group-hover:text-[color:var(--color-accent)] @3xl:order-none"
        >
          {open ? '−' : '+'}
        </span>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="border-t border-[color:var(--color-border-soft)] px-3 py-5 @3xl:pl-[calc(0.75rem+2.75rem)] @3xl:pr-6"
      >
        <div className="flex max-w-[62ch] flex-col gap-4">
          {project.descriptionHtml && (
            // Sanitized server-side by isomorphic-dompurify (ADR-14).
            <div
              className="space-y-2 text-sm leading-relaxed text-[color:var(--color-text-secondary)] [&_a]:text-[color:var(--color-text-primary)] [&_a]:underline [&_code]:font-mono [&_li]:pl-1 [&_li::marker]:text-[color:var(--color-text-faint)] [&_strong]:font-medium [&_strong]:text-[color:var(--color-text-primary)] [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-4"
              dangerouslySetInnerHTML={{ __html: project.descriptionHtml }}
            />
          )}
          {period && !project.descriptionHtml && (
            <p className="font-mono text-xs text-[color:var(--color-text-muted)]">{period}</p>
          )}
          {(project.liveUrl || project.repoUrl) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={PANEL_LINK}
                >
                  Live site <span aria-hidden="true">↗</span>
                </a>
              )}
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={PANEL_LINK}
                >
                  Source <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  const sorted = [...projects].sort((a, b) => {
    const fa = a.featuredOrder ?? Number.POSITIVE_INFINITY;
    const fb = b.featuredOrder ?? Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    return (b.startedAt ?? '').localeCompare(a.startedAt ?? '');
  });
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());

  if (sorted.length === 0) {
    return (
      <p className="font-mono text-sm text-[color:var(--color-text-muted)]">
        No projects to show yet.
      </p>
    );
  }

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div>
      {/* Column header. Hidden on small screens, where each row stacks. */}
      <div
        className={`${GRID} hidden border-t border-[color:var(--color-border)] py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-faint)] @3xl:grid`}
      >
        <span>Project</span>
        <span>What it does</span>
        <span />
      </div>

      <ul className="flex flex-col">
        {sorted.map((project, index) => (
          <ProjectRow
            key={project.id}
            project={project}
            large={index < FEATURED_LARGE && project.featuredOrder !== null}
            open={openIds.has(project.id)}
            onToggle={() => toggle(project.id)}
          />
        ))}
      </ul>

      <div className="border-t border-[color:var(--color-border)]" />
    </div>
  );
}
