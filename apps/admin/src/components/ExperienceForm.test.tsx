/**
 * Tests for ExperienceForm component.
 * TDD: RED → GREEN — mirrors ProjectForm.test.tsx pattern (no markdown, no image upload).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../lib/api.js', () => ({
  experiencesClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
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

const fakeExperience = {
  id: 'exp-1',
  company: 'Acme Corp',
  role: 'Software Engineer',
  summary: 'Built things at scale',
  location: 'Remote',
  displayOrder: 1,
  startedAt: '2021-01-01',
  endedAt: '2023-06-01',
  createdAt: '2021-01-01T00:00:00Z',
};

describe('ExperienceForm — new experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required fields for a new experience', async () => {
    const { ExperienceForm } = await import('./ExperienceForm.js');
    render(<ExperienceForm />, { wrapper });

    expect(screen.getByRole('textbox', { name: /company/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /role/i })).toBeInTheDocument();
  });

  it('calls create mutation on valid submit', async () => {
    mockCreate.mockResolvedValue({
      ok: true,
      json: async () => fakeExperience,
    });

    const user = userEvent.setup();
    const { ExperienceForm } = await import('./ExperienceForm.js');
    render(<ExperienceForm />, { wrapper });

    await user.type(screen.getByRole('textbox', { name: /company/i }), 'Acme Corp');
    await user.type(screen.getByRole('textbox', { name: /role/i }), 'Software Engineer');
    // displayOrder is a spinbutton (number input)
    await user.type(screen.getByRole('spinbutton', { name: /display order/i }), '1');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  it('shows validation error when required fields are empty', async () => {
    const user = userEvent.setup();
    const { ExperienceForm } = await import('./ExperienceForm.js');
    render(<ExperienceForm />, { wrapper });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/company is required/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('ExperienceForm — edit existing experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-populates fields with existing experience data', async () => {
    const { ExperienceForm } = await import('./ExperienceForm.js');
    render(<ExperienceForm experience={fakeExperience} />, { wrapper });

    expect(screen.getByRole('textbox', { name: /company/i })).toHaveValue('Acme Corp');
    expect(screen.getByRole('textbox', { name: /role/i })).toHaveValue('Software Engineer');
  });

  it('calls update mutation when editing existing experience', async () => {
    mockUpdate.mockResolvedValue({
      ok: true,
      json: async () => ({ ...fakeExperience, company: 'New Corp' }),
    });

    const user = userEvent.setup();
    const { ExperienceForm } = await import('./ExperienceForm.js');
    render(<ExperienceForm experience={fakeExperience} />, { wrapper });

    const companyInput = screen.getByRole('textbox', { name: /company/i });
    await user.clear(companyInput);
    await user.type(companyInput, 'New Corp');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({ company: 'New Corp' })
      );
    });
  });
});
