/**
 * TDD RED → GREEN — ExperienceIsland component tests.
 *
 * Tests (Phase pre-5, carried forward):
 * 1. Renders cards from experiences prop
 * 2. Renders correct semantic elements (article[data-portfolio-experience-card])
 * 3. Mocks animation factory — factory called on mount with root element
 * 4. Cleanup: timeline.kill() called on unmount
 * 5. Empty experiences renders no cards
 * 6. summaryHtml rendered via dangerouslySetInnerHTML
 *
 * Tests (Phase 5 — DSI restyle):
 * 7. Renders company name in each card
 * 8. Renders role in each card
 * 9. Renders date range in each card
 * 10. Renders summaryHtml content (sanitized server-side, ADR-14)
 * 11. Alternating layout: index 0 card has 'md:col-start-1' (left side)
 * 12. Alternating layout: index 1 card has 'md:col-start-2' (right side)
 * 13. Cards carry hover:border-accent class indicator
 * 14. Timeline line element present in DOM
 * 15. data-portfolio-experience-card preserved on all cards
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

    const cards = container.querySelectorAll('article[data-portfolio-experience-card]');
    expect(cards).toHaveLength(2);
  });

  it('renders summaryHtml via dangerouslySetInnerHTML when provided', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(container.innerHTML).toContain('Built distributed systems at scale.');
  });

  it('calls animation factory on mount', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    render(<ExperienceIsland experiences={fakeExperiences} />);

    expect(mockTimelineFactory).toHaveBeenCalledTimes(1);
    expect(mockTimelineFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls timeline.kill() on unmount (cleanup)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { unmount } = render(<ExperienceIsland experiences={fakeExperiences} />);

    unmount();

    expect(mockKill).toHaveBeenCalledTimes(1);
  });

  it('renders empty section when no experiences', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={[]} />);

    const cards = container.querySelectorAll('article[data-portfolio-experience-card]');
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

  it('first card (index 0) is positioned on the left side of timeline on desktop (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('article[data-portfolio-experience-card]');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Index 0 → left side: md:col-start-1 or data-side="left"
    const firstCard = cards[0];
    const firstWrapper = firstCard.closest('[data-timeline-side]') ?? firstCard;
    const sideAttr = firstWrapper.getAttribute('data-timeline-side');
    if (sideAttr !== null) {
      expect(sideAttr).toBe('left');
    } else {
      // fallback: class-based check
      const classStr = firstCard.className + (firstCard.closest('[class]')?.className ?? '');
      expect(classStr).toMatch(/md:col-start-1|left/);
    }
  });

  it('second card (index 1) is positioned on the right side of timeline on desktop (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('article[data-portfolio-experience-card]');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // Index 1 → right side: md:col-start-2 or data-side="right"
    const secondCard = cards[1];
    const secondWrapper = secondCard.closest('[data-timeline-side]') ?? secondCard;
    const sideAttr = secondWrapper.getAttribute('data-timeline-side');
    if (sideAttr !== null) {
      expect(sideAttr).toBe('right');
    } else {
      const classStr = secondCard.className + (secondCard.closest('[class]')?.className ?? '');
      expect(classStr).toMatch(/md:col-start-2|right/);
    }
  });

  it('cards include hover border-glow class indicator (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    // Card component is rendered with hover=true which produces data-hover="true"
    const hoverCards = container.querySelectorAll('[data-hover="true"]');
    expect(hoverCards.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the vertical timeline line element (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    // Timeline line is a decorative aria-hidden div with data-timeline-line
    const line = container.querySelector('[data-timeline-line]');
    expect(line).toBeInTheDocument();
  });

  it('preserves data-portfolio-experience-card on all entries after restyle (Phase 5)', async () => {
    const { ExperienceIsland } = await import('./ExperienceIsland.js');
    const { container } = render(<ExperienceIsland experiences={fakeExperiences} />);

    const cards = container.querySelectorAll('[data-portfolio-experience-card]');
    expect(cards).toHaveLength(2);
  });
});
