/**
 * TDD RED → GREEN — ProjectsIsland component tests.
 *
 * Mirrors ExperienceIsland.test.tsx pattern.
 * Extra tests: heroImageUrl present → renders img; heroImageUrl null → no img.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProject } from '../../lib/portfolio-fetch.js';

// ---------------------------------------------------------------------------
// Mocks — animations factory
// ---------------------------------------------------------------------------

const mockKill = vi.fn();
const mockTimelineFactory = vi.fn(() => ({ kill: mockKill }));

vi.mock('@jcsoftdev/animations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@jcsoftdev/animations')>();
  return {
    ...original,
    createProjectsStaggerTimeline: mockTimelineFactory,
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const heroUrl = 'http://localhost:9000/posts-media/posts/user1/2026/01/hero.jpg';

const fakeProjects: PublicProject[] = [
  {
    id: 'proj-1',
    slug: 'my-project',
    name: 'My Project',
    summary: 'A cool project summary.',
    descriptionHtml: '<p>Detailed description</p>',
    repoUrl: 'https://github.com/user/repo',
    liveUrl: 'https://myproject.dev',
    featuredOrder: 1,
    startedAt: '2024-01-01',
    endedAt: null,
    heroImageUrl: heroUrl,
  },
  {
    id: 'proj-2',
    slug: 'another-project',
    name: 'Another Project',
    summary: 'Another summary.',
    descriptionHtml: null,
    repoUrl: null,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2023-06-01',
    endedAt: '2024-01-01',
    heroImageUrl: null,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectsIsland', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a card for each project', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    render(<ProjectsIsland projects={fakeProjects} />);

    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('Another Project')).toBeInTheDocument();
  });

  it('renders article elements with data-portfolio-project-card attribute', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    const { container } = render(<ProjectsIsland projects={fakeProjects} />);

    const cards = container.querySelectorAll('article[data-portfolio-project-card]');
    expect(cards).toHaveLength(2);
  });

  it('renders hero image when heroImageUrl is set', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    render(<ProjectsIsland projects={fakeProjects} />);

    const img = screen.getByRole('img', { name: /my project/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', heroUrl);
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('does not render img when heroImageUrl is null', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    render(<ProjectsIsland projects={fakeProjects} />);

    // Only one img in total — the second project has no hero
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
  });

  it('renders repo and live links when provided', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    render(<ProjectsIsland projects={fakeProjects} />);

    expect(screen.getByRole('link', { name: /repo/i })).toHaveAttribute(
      'href',
      'https://github.com/user/repo'
    );
    expect(screen.getByRole('link', { name: /live/i })).toHaveAttribute(
      'href',
      'https://myproject.dev'
    );
  });

  it('calls animation factory on mount', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    render(<ProjectsIsland projects={fakeProjects} />);

    expect(mockTimelineFactory).toHaveBeenCalledTimes(1);
    expect(mockTimelineFactory).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('calls timeline.kill() on unmount (cleanup)', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    const { unmount } = render(<ProjectsIsland projects={fakeProjects} />);

    unmount();

    expect(mockKill).toHaveBeenCalledTimes(1);
  });

  it('renders empty section when no projects', async () => {
    const { ProjectsIsland } = await import('./ProjectsIsland.js');
    const { container } = render(<ProjectsIsland projects={[]} />);

    const cards = container.querySelectorAll('article[data-portfolio-project-card]');
    expect(cards).toHaveLength(0);
  });
});
