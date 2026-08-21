/**
 * Tests for PostEditor component.
 * TDD phase — GREEN: tests against implemented component.
 *
 * Phase 7 carryover: includes tests for the MDX preview integration
 * via POST /api/v1/preview (debounced 400ms).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockPreviewCompile = vi.fn();

vi.mock('../lib/api.js', () => ({
  postsClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
  },
  uploadClient: {
    presign: vi.fn(),
    finalize: vi.fn(),
  },
  previewClient: {
    compile: mockPreviewCompile,
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

const fakePost = {
  id: 'post-1',
  title: 'Test Post',
  slug: 'test-post',
  content: '# Hello',
  excerpt: 'A short excerpt',
  status: 'draft' as const,
  heroMediaId: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('PostEditor — new post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and content fields for a new post', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument();
  });

  it('renders a preview pane label', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    // Multiple elements can match /preview/i (label + placeholder); just check at least one exists
    expect(screen.getAllByText(/preview/i).length).toBeGreaterThan(0);
  });

  it('calls createPost mutation on submit for new post', async () => {
    mockCreate.mockResolvedValue({
      ok: true,
      json: async () => fakePost,
    });

    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My New Post');
    await user.type(screen.getByRole('textbox', { name: /slug/i }), 'my-new-post');
    await user.type(screen.getByRole('textbox', { name: /content/i }), '# Hello World');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My New Post', slug: 'my-new-post' })
      );
    });
  });

  it('shows validation error when title is empty', async () => {
    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('shows validation error when slug is empty', async () => {
    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/slug is required/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('marks invalid fields with aria-invalid and aria-describedby', async () => {
    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    const titleInput = await screen.findByRole('textbox', { name: /title/i });
    await waitFor(() => {
      expect(titleInput).toHaveAttribute('aria-invalid', 'true');
      expect(titleInput).toHaveAttribute('aria-describedby', 'title-input-error');
    });
  });

  it('rejects the create mutation when the API responds with a non-2xx status', async () => {
    mockCreate.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Slug already taken' }),
    });

    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My New Post');
    await user.type(screen.getByRole('textbox', { name: /slug/i }), 'my-new-post');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Slug already taken');
    });
  });

  it('renders a status selector defaulting to draft', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    expect(screen.getByRole('combobox', { name: /status/i })).toHaveValue('draft');
  });

  it('renders an excerpt field', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    expect(screen.getByRole('textbox', { name: /excerpt/i })).toBeInTheDocument();
  });

  it('renders the hero image upload widget', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });
});

describe('PostEditor — edit existing post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates fields with existing post data', async () => {
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor post={fakePost} />, { wrapper });

    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('Test Post');
    expect(screen.getByRole('textbox', { name: /^slug/i })).toHaveValue('test-post');
    expect(screen.getByRole('textbox', { name: /content/i })).toHaveValue('# Hello');
    expect(screen.getByRole('textbox', { name: /excerpt/i })).toHaveValue('A short excerpt');
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveValue('draft');
  });

  it('calls updatePost mutation when editing existing post', async () => {
    mockUpdate.mockResolvedValue({
      ok: true,
      json: async () => ({ ...fakePost, title: 'Updated Title' }),
    });

    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor post={fakePost} />, { wrapper });

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('includes the selected status transition in the PATCH payload', async () => {
    mockUpdate.mockResolvedValue({
      ok: true,
      json: async () => ({ ...fakePost, status: 'published' }),
    });

    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor post={fakePost} />, { wrapper });

    await user.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'published');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'post-1',
        expect.objectContaining({ status: 'published' })
      );
    });
  });

  it('rejects the update mutation when the API responds with a non-2xx status', async () => {
    mockUpdate.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });

    const user = userEvent.setup();
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor post={fakePost} />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Forbidden');
    });
  });
});

describe('PostEditor — MDX preview (Phase 7 carryover)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows placeholder text when no content has been typed', async () => {
    // Before any content change, the preview shows the placeholder
    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    expect(screen.getByText(/preview will appear here/i)).toBeInTheDocument();
    expect(mockPreviewCompile).not.toHaveBeenCalled();
  });

  it('calls previewClient.compile after debounce when content changes via fireEvent', async () => {
    mockPreviewCompile.mockResolvedValue({
      ok: true,
      json: async () => ({ html: '<h1>Hello</h1>' }),
    });

    // Use fireEvent to trigger onChange directly — avoids userEvent + fake timer deadlocks
    const { fireEvent } = await import('@testing-library/react');
    vi.useFakeTimers();

    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    const contentInput = screen.getByRole('textbox', { name: /content/i });

    // Trigger change directly — this bypasses userEvent typing simulation
    fireEvent.change(contentInput, { target: { value: '# Hello' } });

    // Advance past debounce
    vi.advanceTimersByTime(500);
    await Promise.resolve(); // flush microtask queue

    // compile should have been scheduled
    expect(mockPreviewCompile).toHaveBeenCalledWith('# Hello');

    vi.useRealTimers();
  });

  it('does not call previewClient.compile before debounce elapses', async () => {
    mockPreviewCompile.mockResolvedValue({
      ok: true,
      json: async () => ({ html: '<h1>Hello</h1>' }),
    });

    const { fireEvent } = await import('@testing-library/react');
    vi.useFakeTimers();

    const { PostEditor } = await import('./PostEditor.js');
    render(<PostEditor />, { wrapper });

    const contentInput = screen.getByRole('textbox', { name: /content/i });
    fireEvent.change(contentInput, { target: { value: '# Hello' } });

    // Only 200ms elapsed — debounce not fired yet
    vi.advanceTimersByTime(200);

    expect(mockPreviewCompile).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
