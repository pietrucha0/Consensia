import { z } from 'zod';

/** Files served by /api/uploads/[file] (see src/lib/storage.ts). */
export const UPLOAD_URL_PATTERN = /^\/api\/uploads\/[0-9a-f-]{36}\.(?:jpg|png|gif|webp|avif)$/;

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Uploaded file or external https:// image; empty string = no image. */
export const imageUrlField = z
  .string()
  .trim()
  .max(2048, { error: 'tooLong' })
  .refine((value) => value === '' || UPLOAD_URL_PATTERN.test(value) || isHttpsUrl(value), { error: 'urlInvalid' });

/** External https:// link (documents, attachments); empty string = none. */
export const httpsUrlField = z
  .string()
  .trim()
  .max(2048, { error: 'tooLong' })
  .refine((value) => value === '' || isHttpsUrl(value), { error: 'urlInvalid' });
