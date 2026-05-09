/**
 * Tests for PostsTable component.
 * TDD phase — GREEN: tests against implemented component.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the postsClient from api.js
const mockPostsList = vi.fn();
vi.mock('../lib/api.js', () => ({
  postsClient: {
    list: mockPostsList,
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  uploadClient: {
    presign: vi.fn(),
    finalize: vi.fn(),
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

const fakePosts = [
  {
    id: '1',
    title: 'First Post',
    slug: 'first-post',
    status: 'published',
    created_at: '2024-01-01T00:00:00Z',
    content: '',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    title: 'Draft Post',
    slug: 'draft-post',
    status: 'draft',
    created_at: '2024-01-02T00:00:00Z',
    content: '',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

describe('PostsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a table with post rows from useQuery', async () => {
    mockPostsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakePosts, total: 2 }),
    });

    const { PostsTable } = await import('./PostsTable.js');
    render(<PostsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('First Post')).toBeInTheDocument();
      expect(screen.getByText('Draft Post')).toBeInTheDocument();
    });
  });

  it('renders loading state initially', async () => {
    mockPostsList.mockImplementation(() => new Promise(() => {})); // never resolves

    const { PostsTable } = await import('./PostsTable.js');
    render(<PostsTable />, { wrapper });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows status filter and filters posts by status', async () => {
    mockPostsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakePosts, total: 2 }),
    });

    const user = userEvent.setup();
    const { PostsTable } = await import('./PostsTable.js');
    render(<PostsTable />, { wrapper });

    // Status filter select should exist
    const filter = await screen.findByRole('combobox', { name: /status/i });
    expect(filter).toBeInTheDocument();

    // Changing status filter triggers re-query
    await user.selectOptions(filter, 'draft');
    // After selection, mockPostsList should have been called again (first call + filter change)
    await waitFor(() => {
      expect(mockPostsList).toHaveBeenCalledTimes(2);
    });
  });

  it('shows next/prev pagination buttons', async () => {
    mockPostsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakePosts, total: 20 }),
    });

    const { PostsTable } = await import('./PostsTable.js');
    render(<PostsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });

  it('disables previous button on first page', async () => {
    mockPostsList.mockResolvedValue({
      ok: true,
      json: async () => ({ items: fakePosts, total: 2 }),
    });

    const { PostsTable } = await import('./PostsTable.js');
    render(<PostsTable />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    });
  });
});
