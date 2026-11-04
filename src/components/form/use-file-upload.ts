'use client';

import { useRef, useState } from 'react';

export const UPLOAD_ERRORS = ['upload_rate_limited', 'upload_too_large', 'upload_invalid_type', 'upload_failed'] as const;
export type UploadError = (typeof UPLOAD_ERRORS)[number];

/** Mirrors the server limits in src/lib/storage.ts (the server re-checks everything). */
const MAX_BYTES = { image: 5 * 1024 * 1024, document: 10 * 1024 * 1024 } as const;

export const UPLOAD_ACCEPT = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  document: 'application/pdf',
} as const;

function isUploadSuccess(data: unknown): data is { url: string } {
  return typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string';
}

function isUploadFailure(data: unknown): data is { error: UploadError } {
  return typeof data === 'object' && data !== null && 'error' in data && UPLOAD_ERRORS.some((code) => code === data.error);
}

/** POSTs a file to /api/uploads and hands the stored URL to `onUploaded`. */
export function useFileUpload(kind: 'image' | 'document', onUploaded: (url: string) => void) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES[kind]) {
      setError('upload_too_large');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isUploadSuccess(data)) onUploaded(data.url);
      else setError(isUploadFailure(data) ? data.error : 'upload_failed');
    } catch {
      setError('upload_failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return { fileInput, uploading, error, upload };
}
