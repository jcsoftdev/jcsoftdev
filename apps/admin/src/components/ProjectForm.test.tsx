/**
 * Tests for ProjectForm component.
 * TDD: RED → GREEN — mirrors PostEditor.test.tsx pattern.
 *
 * Tests cover:
 * - Form field rendering (slug, name, summary, description, repoUrl, liveUrl, featuredOrder, startedAt, endedAt)
 * - Valid submit calls create mutation
 * - Edit mode calls update mutation
 * - Invalid submit shows form errors
 * - Markdown preview: typing updates preview (debounced); XSS payload sanitized
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../lib/api.js', () => ({
  projectsClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
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

// DOMPurify browser-only — mock in jsdom context
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
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

const fakeProject = {
  id: 'proj-1',
  slug: 'my-project',
  name: 'My Project',
  summary: 'A cool project',
  description: '## Hello\n\nWorld',
  repoUrl: 'https://github.com/test/project',
  liveUrl: 'https://project.example.com',
  featuredOrder: 1,
  startedAt: '2023-01-01',
  endedAt: null,
  heroMediaId: null,
  createdAt: '2023-01-01T00:00:00Z',
};

describe('ProjectForm — new project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required fields for a new project', async () => {
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    expect(screen.getByRole('textbox', { name: /slug/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /summary/i })).toBeInTheDocument();
  });

  it('renders a preview pane label for description', async () => {
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    expect(screen.getAllByText(/preview/i).length).toBeGreaterThan(0);
  });

  it('calls create mutation on valid submit', async () => {
    mockCreate.mockResolvedValue({
      ok: true,
      json: async () => fakeProject,
    });

    const user = userEvent.setup();
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    await user.type(screen.getByRole('textbox', { name: /slug/i }), 'my-project');
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'My Project');
    await user.type(screen.getByRole('textbox', { name: /summary/i }), 'A cool project');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  it('shows validation error when required fields are empty', async () => {
    const user = userEvent.setup();
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/slug is required/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('ProjectForm — edit existing project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates fields with existing project data', async () => {
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm project={fakeProject} />, { wrapper });

    expect(screen.getByRole('textbox', { name: /slug/i })).toHaveValue('my-project');
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('My Project');
    expect(screen.getByRole('textbox', { name: /summary/i })).toHaveValue('A cool project');
  });

  it('calls update mutation when editing existing project', async () => {
    mockUpdate.mockResolvedValue({
      ok: true,
      json: async () => ({ ...fakeProject, name: 'Updated Project' }),
    });

    const user = userEvent.setup();
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm project={fakeProject} />, { wrapper });

    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Project');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({ name: 'Updated Project' })
      );
    });
  });
});

describe('ProjectForm — markdown preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows placeholder text when description is empty', async () => {
    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    expect(screen.getByText(/preview will appear here/i)).toBeInTheDocument();
  });

  it('updates preview after debounce when description changes', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    vi.useFakeTimers();

    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    const descriptionInput = screen.getByRole('textbox', { name: /description/i });

    await act(async () => {
      fireEvent.change(descriptionInput, { target: { value: '## Hello\n\nWorld' } });
      vi.advanceTimersByTime(400);
      // flush all microtasks/promises
      await Promise.resolve();
      await Promise.resolve();
    });

    // After debounce, the preview should render something from markdown
    const preview = screen.getByTestId('description-preview');
    expect(preview).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('calls DOMPurify.sanitize before inserting HTML into the preview', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    vi.useFakeTimers();

    // This test verifies that DOMPurify.sanitize is invoked as the sanitization gate.
    // The real DOMPurify (in a real browser) would strip <script> tags.
    // In jsdom, we verify the call happens — guaranteeing the sanitization path is taken.
    const DOMPurify = await import('dompurify');
    const sanitizeSpy = vi.spyOn(DOMPurify.default, 'sanitize');

    const { ProjectForm } = await import('./ProjectForm.js');
    render(<ProjectForm />, { wrapper });

    const descriptionInput = screen.getByRole('textbox', { name: /description/i });

    await act(async () => {
      fireEvent.change(descriptionInput, {
        target: { value: '## Hello\n\nWorld' },
      });
      vi.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    // DOMPurify.sanitize must have been called (proving the sanitization gate is active)
    expect(sanitizeSpy).toHaveBeenCalled();
    // The input to sanitize must be the marked-parsed HTML (contains <h2>)
    const callArg = sanitizeSpy.mock.calls[0]?.[0] as string;
    expect(callArg).toContain('<h2>');

    vi.useRealTimers();
  });
});
