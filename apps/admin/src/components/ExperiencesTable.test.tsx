/**
 * Tests for ExperiencesTable component.
 * TDD: RED → GREEN — mirrors ProjectsTable.test.tsx pattern.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExperiencesList = vi.fn();
const mockExperiencesDelete = vi.fn();

vi.mock('../lib/api.js', () => ({
  experiencesClient: {
    list: mockExperiencesList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: mockExperiencesDelete,
  },
  projectsClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  postsClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  uploadClient: {
    presign: vi.fn(),
    finalize: vi.fn(),
  },
  previewClient: {
    compile: vi.fn(),
  },
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const fakeExperiences = [
  {
    id: 'exp-1',
    company: 'Acme Corp',
    role: 'Software Engineer',
    summary: 'Built things',
    location: 'Remote',
    displayOrder: 1,
    startedAt: '2021-01-01',
    endedAt: '2023-06-01',
    createdAt: '2021-01-01T00:00:00Z',
  },
  {
    id: 'exp-2',
    company: 'Tech Startup',
    role: 'Senior Developer',
    summary: 'Led team',
    location: 'New York',
    displayOrder: 2,
    startedAt: '2023-07-01',
    endedAt: null,
    createdAt: '2023-07-01T00:00:00Z',
  },
];

describe('ExperiencesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a table with experience rows from useQuery', async () => {
    mockExperiencesList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeExperiences, total: 2 }),
    });

    const { ExperiencesTable } = await import('./ExperiencesTable.js');
    render(<ExperiencesTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Tech Startup')).toBeInTheDocument();
    });
  });

  it('renders loading state initially', async () => {
    mockExperiencesList.mockImplementation(() => new Promise(() => {}));

    const { ExperiencesTable } = await import('./ExperiencesTable.js');
    render(<ExperiencesTable />, { wrapper });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows next/prev pagination buttons', async () => {
    mockExperiencesList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeExperiences, total: 25 }),
    });

    const { ExperiencesTable } = await import('./ExperiencesTable.js');
    render(<ExperiencesTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    });
  });

  it('disables previous button on first page', async () => {
    mockExperiencesList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeExperiences, total: 2 }),
    });

    const { ExperiencesTable } = await import('./ExperiencesTable.js');
    render(<ExperiencesTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });

  it('calls delete client when delete button is clicked', async () => {
    mockExperiencesList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeExperiences, total: 2 }),
    });
    mockExperiencesDelete.mockResolvedValue({ ok: true, status: 204 });

    const user = userEvent.setup();
    const { ExperiencesTable } = await import('./ExperiencesTable.js');
    render(<ExperiencesTable />, { wrapper });

    const deleteBtns = await screen.findAllByRole('button', { name: /delete/i });
    const firstDeleteBtn = deleteBtns[0];
    if (!firstDeleteBtn) throw new Error('No delete button found');
    await user.click(firstDeleteBtn);

    await waitFor(() => {
      expect(mockExperiencesDelete).toHaveBeenCalledWith('exp-1');
    });
  });
});
