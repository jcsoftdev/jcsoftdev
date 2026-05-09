/**
 * ImageUploadWidget — presigned PUT flow per design §9 + ADR-5.
 *
 * Flow:
 * 1. User selects file → validate type client-side
 * 2. Call POST /api/v1/upload/presign → receive { uploadUrl, objectKey, headers }
 * 3. PUT file directly to MinIO using presigned URL (browser fetch)
 * 4. Call POST /api/v1/upload/finalize → receive Media row
 * 5. onSuccess(media) callback fires
 *
 * Allowed types: image/jpeg, image/png, image/webp, image/avif
 * Max size: 5MB (matches API validation)
 */
import { useRef, useState } from 'react';
import { type Media, uploadClient } from '../lib/api.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageUploadWidgetProps {
  onSuccess: (media: Media) => void;
}

type UploadState = 'idle' | 'uploading' | 'error';

export function ImageUploadWidget({ onSuccess }: ImageUploadWidgetProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErrorMessage(null);

    // Client-side validation
    if (!ALLOWED_TYPES.has(file.type)) {
      setErrorMessage('File type not allowed. Use JPEG, PNG, WebP, or AVIF.');
      setState('error');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setErrorMessage('File is too large. Maximum size is 5MB.');
      setState('error');
      return;
    }

    setState('uploading');
    try {
      // Step 1: Get presigned URL
      const presignRes = await uploadClient.presign({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      if (!presignRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, objectKey, headers } = (await presignRes.json()) as {
        uploadUrl: string;
        objectKey: string;
        headers: Record<string, string>;
      };

      // Step 2: PUT file directly to MinIO
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          ...headers,
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error('Upload failed. Please try again.');
      }

      // Step 3: Finalize — create media row in database
      const finalizeRes = await uploadClient.finalize({
        objectKey,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!finalizeRes.ok) {
        throw new Error('Failed to finalize upload');
      }

      const media = (await finalizeRes.json()) as unknown as Media;
      setState('idle');
      onSuccess(media);

      // Reset the input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={state === 'uploading'}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
          }
        }}
        className="text-sm"
      />

      {state === 'uploading' && <p className="text-sm text-gray-500">Uploading...</p>}

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
