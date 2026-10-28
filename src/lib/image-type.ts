export type ImageType = { ext: 'jpg' | 'png' | 'gif' | 'webp' | 'avif'; mime: string };

export const IMAGE_MIME_BY_EXT: Record<ImageType['ext'], string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

/**
 * Detects the image format from magic bytes — the client's filename and MIME type
 * are never trusted. SVG is deliberately unsupported (it can carry scripts).
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const detect = (ext: ImageType['ext']): ImageType => ({ ext, mime: IMAGE_MIME_BY_EXT[ext] });

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return detect('jpg');
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return detect('png');
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return detect('gif');
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return detect('webp');
  if (startsWith(bytes, ascii('ftypavif'), 4) || startsWith(bytes, ascii('ftypavis'), 4)) return detect('avif');
  return null;
}
