/**
 * Tests for ImageUploadWidget component.
 * TDD phase — GREEN: tests against implemented component.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPresign = vi.fn();
const mockFinalize = vi.fn();
const mockFetch = vi.fn();

// Mock global fetch for the presigned PUT
global.fetch = mockFetch as typeof fetch;

vi.mock('../lib/api.js', () => ({
  postsClient: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  uploadClient: {
    presign: mockPresign,
    finalize: mockFinalize,
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

const fakeMedia = {
  id: 'media-1',
  objectKey: 'posts/user1/2024/01/uuid-image.jpg',
  bucket: 'posts-media',
  mimeType: 'image/jpeg',
  sizeBytes: 102400,
};

describe('ImageUploadWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a file input', async () => {
    const onSuccess = vi.fn();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });

  it('calls presign API when file is selected', async () => {
    mockPresign.mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadUrl: 'http://minio:9000/posts-media/key?sig=abc',
        objectKey: fakeMedia.objectKey,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    });
    mockFetch.mockResolvedValue({ ok: true });
    mockFinalize.mockResolvedValue({
      ok: true,
      json: async () => fakeMedia,
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('file-input');
    await user.upload(input, file);

    await waitFor(() => {
      expect(mockPresign).toHaveBeenCalled();
    });
  });

  it('PUTs file to presigned URL after getting presign response', async () => {
    const uploadUrl = 'http://minio:9000/posts-media/key?sig=abc';
    mockPresign.mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadUrl,
        objectKey: fakeMedia.objectKey,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    });
    mockFetch.mockResolvedValue({ ok: true });
    mockFinalize.mockResolvedValue({
      ok: true,
      json: async () => fakeMedia,
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('file-input'), file);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(uploadUrl, expect.objectContaining({ method: 'PUT' }));
    });
  });

  it('calls onSuccess callback with media after successful upload + finalize', async () => {
    mockPresign.mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadUrl: 'http://minio:9000/posts-media/key?sig=abc',
        objectKey: fakeMedia.objectKey,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    });
    mockFetch.mockResolvedValue({ ok: true });
    mockFinalize.mockResolvedValue({
      ok: true,
      json: async () => fakeMedia,
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('file-input'), file);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(fakeMedia);
    });
  });

  it('shows error state when file type is not accepted', async () => {
    const onSuccess = vi.fn();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    const file = new File(['doc'], 'document.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('file-input');

    // Use fireEvent.change to bypass userEvent's accept attribute checking
    // so we can test our own client-side validation logic
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
    });
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it('shows error state when PUT to presigned URL fails', async () => {
    mockPresign.mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadUrl: 'http://minio:9000/posts-media/key?sig=abc',
        objectKey: fakeMedia.objectKey,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    });
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const { ImageUploadWidget } = await import('./ImageUploadWidget.js');
    render(<ImageUploadWidget onSuccess={onSuccess} />, { wrapper });

    const file = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('file-input'), file);

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
