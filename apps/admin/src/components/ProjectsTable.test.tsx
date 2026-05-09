/**
 * Tests for ProjectsTable component.
 * TDD: RED → GREEN — tests mirror PostsTable.test.tsx pattern.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProjectsList = vi.fn();
const mockProjectsDelete = vi.fn();

vi.mock('../lib/api.js', () => ({
  projectsClient: {
    list: mockProjectsList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: mockProjectsDelete,
  },
  experiencesClient: {
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

const fakeProjects = [
  {
    id: 'proj-1',
    slug: 'my-project',
    name: 'My Project',
    summary: 'A cool project',
    featuredOrder: 1,
    startedAt: '2023-01-01',
    endedAt: null,
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'proj-2',
    slug: 'another-project',
    name: 'Another Project',
    summary: 'Another cool project',
    featuredOrder: null,
    startedAt: '2022-06-01',
    endedAt: '2023-06-01',
    createdAt: '2022-06-01T00:00:00Z',
  },
];

describe('ProjectsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a table with project rows from useQuery', async () => {
    mockProjectsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeProjects, total: 2 }),
    });

    const { ProjectsTable } = await import('./ProjectsTable.js');
    render(<ProjectsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('Another Project')).toBeInTheDocument();
    });
  });

  it('renders loading state initially', async () => {
    mockProjectsList.mockImplementation(() => new Promise(() => {})); // never resolves

    const { ProjectsTable } = await import('./ProjectsTable.js');
    render(<ProjectsTable />, { wrapper });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows next/prev pagination buttons', async () => {
    mockProjectsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeProjects, total: 25 }),
    });

    const { ProjectsTable } = await import('./ProjectsTable.js');
    render(<ProjectsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    });
  });

  it('disables previous button on first page', async () => {
    mockProjectsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeProjects, total: 2 }),
    });

    const { ProjectsTable } = await import('./ProjectsTable.js');
    render(<ProjectsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });

  it('calls delete client when delete button is clicked', async () => {
    mockProjectsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakeProjects, total: 2 }),
    });
    mockProjectsDelete.mockResolvedValue({ ok: true, status: 204 });

    const user = userEvent.setup();
    const { ProjectsTable } = await import('./ProjectsTable.js');
    render(<ProjectsTable />, { wrapper });

    const deleteBtns = await screen.findAllByRole('button', { name: /delete/i });
    const firstDeleteBtn = deleteBtns[0];
    if (!firstDeleteBtn) throw new Error('No delete button found');
    await user.click(firstDeleteBtn);

    await waitFor(() => {
      expect(mockProjectsDelete).toHaveBeenCalledWith('proj-1');
    });
  });
});
