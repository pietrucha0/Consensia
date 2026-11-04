import { getSession } from '@/lib/dal';
import { readUpload } from '@/lib/storage';

/** Serves an uploaded file to signed-in users only (the walled garden covers media too). */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getSession())) return new Response(null, { status: 401 });

  const name = (await params).file;
  const upload = await readUpload(name);
  if (!upload) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(upload.bytes), {
    headers: {
      'Content-Type': upload.mime,
      'Content-Length': String(upload.bytes.byteLength),
      // File names are random and immutable; `private` keeps shared caches/CDNs out.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // PDFs are downloaded rather than rendered by the browser: its built-in viewer runs
      // the document's scripts and cannot work inside the sandbox below.
      'Content-Disposition': upload.ext === 'pdf' ? `attachment; filename="${name}"` : 'inline',
      // Opened directly, an image is a document of its own: allow nothing but the image.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
