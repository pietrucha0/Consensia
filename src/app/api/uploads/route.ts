import { NextResponse } from 'next/server';

import { detectImageType } from '@/lib/image-type';
import { getSession } from '@/lib/dal';
import { consumeRateLimit } from '@/lib/rate-limit';
import { MAX_UPLOAD_BYTES, saveUpload } from '@/lib/storage';

/** multipart overhead allowance on top of the file itself */
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

type UploadError =
  | 'unauthorized'
  | 'forbidden'
  | 'upload_rate_limited'
  | 'upload_too_large'
  | 'upload_invalid_type'
  | 'upload_failed';

const fail = (error: UploadError, status: number) => NextResponse.json({ error }, { status });

function isSameHost(origin: string, host: string | null): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // e.g. "Origin: null" from sandboxed documents
  }
}

/** POST multipart/form-data { file } → 201 { url } — editors (ADMIN, MODERATOR) only. */
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

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return fail('upload_failed', 400);
  }
  if (!(file instanceof File)) return fail('upload_failed', 400);
  if (file.size > MAX_UPLOAD_BYTES) return fail('upload_too_large', 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return fail('upload_invalid_type', 415);

  try {
    const url = await saveUpload(bytes, type);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error('[uploads] save failed', error);
    return fail('upload_failed', 500);
  }
}
