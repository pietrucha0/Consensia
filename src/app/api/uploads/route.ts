import { NextResponse } from 'next/server';

import { getSession } from '@/lib/dal';
import { detectDocumentType, detectImageType, type UploadType } from '@/lib/image-type';
import { consumeRateLimit } from '@/lib/rate-limit';
import { MAX_DOCUMENT_BYTES, MAX_UPLOAD_BYTES, saveUpload } from '@/lib/storage';

/** multipart overhead allowance on top of the largest accepted file */
const MAX_REQUEST_BYTES = Math.max(MAX_UPLOAD_BYTES, MAX_DOCUMENT_BYTES) + 64 * 1024;

type UploadError =
  | 'unauthorized'
  | 'forbidden'
  | 'upload_rate_limited'
  | 'upload_too_large'
  | 'upload_invalid_type'
  | 'upload_failed';

/** What the form asked for: `image` (default) for pictures, `document` for PDF attachments. */
const KINDS = {
  image: { maxBytes: MAX_UPLOAD_BYTES, detect: detectImageType },
  document: { maxBytes: MAX_DOCUMENT_BYTES, detect: detectDocumentType },
} as const satisfies Record<string, { maxBytes: number; detect: (bytes: Uint8Array) => UploadType | null }>;

const fail = (error: UploadError, status: number) => NextResponse.json({ error }, { status });

function isSameHost(origin: string, host: string | null): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // e.g. "Origin: null" from sandboxed documents
  }
}

/** POST multipart/form-data { file, kind? } → 201 { url } — editors (ADMIN, MODERATOR) only. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail('unauthorized', 401);
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MODERATOR') return fail('forbidden', 403);

  // Session cookies are SameSite=Lax already; reject cross-origin posts explicitly as well.
  const origin = request.headers.get('origin');
  if (origin && !isSameHost(origin, request.headers.get('host'))) return fail('forbidden', 403);

  if (!(await consumeRateLimit('upload', session.user.id))) return fail('upload_rate_limited', 429);

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_REQUEST_BYTES) return fail('upload_too_large', 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('upload_failed', 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return fail('upload_failed', 400);
  const kind = form.get('kind') === 'document' ? KINDS.document : KINDS.image;
  if (file.size > kind.maxBytes) return fail('upload_too_large', 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = kind.detect(bytes);
  if (!type) return fail('upload_invalid_type', 415);

  try {
    const url = await saveUpload(bytes, type);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error('[uploads] save failed', error);
    return fail('upload_failed', 500);
  }
}
