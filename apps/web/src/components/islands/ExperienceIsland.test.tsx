/**
 * TDD RED → GREEN — ExperienceIsland component tests.
 *
 * Tests (Phase pre-5, carried forward):
 * 1. Renders cards from experiences prop
 * 2. Renders correct semantic elements (li[data-portfolio-experience-card])
 * 3. Mocks animation factory — factory called on mount with root element
 * 4. Cleanup: timeline.kill() called on unmount
 * 5. Empty experiences renders no cards
 * 6. summaryHtml rendered via dangerouslySetInnerHTML
 *
 * Tests (current design):
 * 7.  Renders company name in each entry
 * 8.  Renders role in each entry
 * 9.  Renders date range in each entry
 * 10. Renders summaryHtml content (sanitized server-side, ADR-14)
 * 11. Entries are <li> inside an <ol> — the layout is a single-column list
 * 12. The in-progress role (endedAt === null) is flagged data-current + "Now"
 * 13. Tech chips render for a company+role present in TECH_BY_ROLE
 * 14. data-portfolio-experience-card preserved on all entries
 *
 * NOTE: this file previously asserted a two-sided timeline — alternating
 * md:col-start-1/2 cards, a [data-timeline-line] rail, and Card's
 * data-hover="true". That design was replaced by the current single-column
 * <ol>; the assertions were never updated, so five tests failed against
 * markup that no longer exists.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicExperience } from '../../lib/portfolio-fetch.js';

// ---------------------------------------------------------------------------
// Mocks — animations factory
// ---------------------------------------------------------------------------

const mockKill = vi.fn();
const mockTimelineFactory = vi.fn(() => ({ kill: mockKill }));

vi.mock('@jcsoftdev/animations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@jcsoftdev/animations')>();
  return {
    ...original,
    createExperienceFadeUpTimeline: mockTimelineFactory,
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakeExperiences: PublicExperience[] = [
  {
    id: 'exp-1',
    company: 'Acme Corp',
    role: 'Software Engineer',
    summaryHtml: '<p>Built distributed systems at scale.</p>',
    startedAt: '2021-01-01',
    endedAt: '2023-06-01',
    location: 'Remote',
    displayOrder: 1,
  },
  {
    id: 'exp-2',
    company: 'Beta Inc',
    role: 'Tech Lead',
    summaryHtml: null,
    startedAt: '2023-07-01',
    endedAt: null,
    location: null,
    displayOrder: 2,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExperienceIsland', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Pre-Phase 5 tests (preserved) ──────────────────────────────────────

  it('renders a card for each experience', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Tech Lead')).toBeInTheDocument();
  });

  it('renders article elements with data-portfolio-experience-card attribute', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('li[data-portfolio-experience-card]');
    expect(cards).toHaveLength(2);
  });

  it('renders summaryHtml via dangerouslySetInnerHTML when provided', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(container.innerHTML).toContain('Built distributed systems at scale.');
  });

  // The rail layout moved the reveal to the page's CSS IntersectionObserver, so
  // this island no longer pulls GSAP in. These two tests used to assert the
  // opposite; they now guard against the dependency creeping back, because a
  // GSAP import here re-adds ~115KB to a list that animates fine without it.
  it('does not depend on the GSAP animation factory', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(mockTimelineFactory).not.toHaveBeenCalled();
  });

  it('unmounts cleanly with no timeline to tear down', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { unmount } = render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(() => unmount()).not.toThrow();
    expect(mockKill).not.toHaveBeenCalled();
  });

  it('renders empty section when no experiences', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={[]} />);

    const cards = container.querySelectorAll('li[data-portfolio-experience-card]');
    expect(cards).toHaveLength(0);
  });

  // ── Phase 5 tests (DSI restyle) ─────────────────────────────────────────

  it('renders company name in each card (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(<ExperienceIsland experiences={fakeExperiences} />);

    // company name must appear as a heading-level element or text node
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('renders role in each card (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Tech Lead')).toBeInTheDocument();
  });

  it('renders date range text in each card (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    // Dates are formatted: "Jan 2021" style — check time elements exist
    const timeEls = container.querySelectorAll('time');
    // exp-1 has startedAt + endedAt = 2 time elements; exp-2 has only startedAt = 1
    expect(timeEls.length).toBeGreaterThanOrEqual(3);
  });

  it('renders summaryHtml content via dangerouslySetInnerHTML (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(container.innerHTML).toContain('Built distributed systems at scale.');
  });

  it('renders entries as <li> inside an <ol> (single-column list, not a two-sided timeline)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const list = container.querySelector('ol');
    expect(list).toBeInTheDocument();

    const cards = container.querySelectorAll('li[data-portfolio-experience-card]');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.parentElement?.tagName).toBe('OL');
    }
  });

  it('flags the in-progress role with data-current and a "Now" badge', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('[data-portfolio-experience-card]');
    // exp-1 ended; exp-2 has endedAt === null and is the current role.
    expect(cards[0]?.getAttribute('data-current')).toBe('false');
    expect(cards[1]?.getAttribute('data-current')).toBe('true');
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('renders tech chips for a company+role present in the tech map', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(
      <ExperienceIsland
        experiences={[
          {
            ...fakeExperiences[0],
            company: 'GlobalLogic',
            role: 'Senior Software Engineer',
          } as PublicExperience,
        ]}
      />
    );

    expect(screen.getByText('Go')).toBeInTheDocument();
    expect(screen.getByText('Postgres')).toBeInTheDocument();
  });

  // Two Globant rows share a company but not a stack — the map is keyed by
  // `company|role` precisely so the frontend row cannot inherit full-stack chips.
  it('keys tech chips by role, not by company alone', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(
      <ExperienceIsland
        experiences={[
          {
            ...fakeExperiences[0],
            company: 'Globant',
            role: 'Frontend Developer',
          } as PublicExperience,
        ]}
      />
    );

    expect(screen.getByText('GTM')).toBeInTheDocument();
    expect(screen.queryByText('DynamoDB')).toBeNull();
  });

  it('renders no tech chips for a company absent from the tech map', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(
      <ExperienceIsland experiences={[fakeExperiences[0] as PublicExperience]} />
    );

    // 'Acme Corp|Software Engineer' is not in TECH_BY_ROLE — the chip <ul> must not render.
    expect(container.querySelector('li[data-portfolio-experience-card] ul')).toBeNull();
  });

  it('preserves data-portfolio-experience-card on all entries', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('[data-portfolio-experience-card]');
    expect(cards).toHaveLength(2);
  });
});
