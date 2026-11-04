import 'server-only';

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '@/env';

import { UPLOAD_MIME_BY_EXT, type UploadType } from './image-type';

/**
 * Local-disk storage for uploaded images and PDF attachments, kept OUTSIDE /public so
 * files are only reachable through the authenticated /api/uploads/[file] route.
 *
 * Swap this module for an S3/R2/Blob driver (same functions) when deploying to
 * serverless hosting, where the local disk is not persistent.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const UPLOAD_URL_PREFIX = '/api/uploads/';

/** `<uuid>.<ext>` — the only names ever written or read (blocks path traversal). */
const FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp|avif|pdf)$/;

function isUploadExt(value: string | undefined): value is UploadType['ext'] {
  return value !== undefined && Object.hasOwn(UPLOAD_MIME_BY_EXT, value);
}

// Runtime data, not code: keep the bundler from tracing (and shipping) the whole project.
const uploadDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.UPLOAD_DIR);

function uploadPath(name: string): string {
  return path.join(/* turbopackIgnore: true */ uploadDir, name);
}

export function isValidUploadName(name: string): boolean {
  return FILE_NAME_PATTERN.test(name);
}

export async function saveUpload(bytes: Uint8Array, type: UploadType): Promise<string> {
  const name = `${crypto.randomUUID()}.${type.ext}`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(uploadPath(name), bytes, { flag: 'wx' });
  return `${UPLOAD_URL_PREFIX}${name}`;
}

export async function readUpload(
  name: string,
): Promise<{ bytes: Buffer; mime: string; ext: UploadType['ext'] } | null> {
  const ext = FILE_NAME_PATTERN.exec(name)?.[1];
  if (!isUploadExt(ext)) return null;
  try {
    const bytes = await readFile(uploadPath(name));
    return { bytes, mime: UPLOAD_MIME_BY_EXT[ext], ext };
  } catch {
    return null;
  }
}

/** Accepts the public URL (`/api/uploads/<name>`); ignores anything that isn't one of our files. */
export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return;
  const name = url.slice(UPLOAD_URL_PREFIX.length);
  if (!isValidUploadName(name)) return;
  await rm(uploadPath(name), { force: true });
}

/** Every stored upload with its public URL and last write time (for orphan cleanup). */
export async function listUploads(): Promise<{ url: string; modifiedAt: Date }[]> {
  let names: string[];
  try {
    names = await readdir(uploadDir);
  } catch {
    return []; // nothing uploaded yet
  }
  const uploads: { url: string; modifiedAt: Date }[] = [];
  for (const name of names) {
    if (!isValidUploadName(name)) continue;
    const info = await stat(uploadPath(name));
    uploads.push({ url: `${UPLOAD_URL_PREFIX}${name}`, modifiedAt: info.mtime });
  }
  return uploads;
}
