import { describe, expect, it } from 'vitest';

import { resolutionFormSchema } from '@/features/resolutions/schemas';
import { toCsv } from '@/lib/csv';
import { detectDocumentType, detectImageType } from '@/lib/image-type';
import { documentUrlField, imageUrlField } from '@/lib/image-url';

const text = (s: string) => new TextEncoder().encode(s);

describe('detectDocumentType', () => {
  it('accepts PDF by its magic bytes', () => {
    expect(detectDocumentType(text('%PDF-1.7\n%âãÏÓ'))?.ext).toBe('pdf');
  });

  it('rejects anything else, including a PDF renamed from HTML', () => {
    expect(detectDocumentType(text('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectDocumentType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // .docx / zip
  });

  it('keeps images and documents apart', () => {
    expect(detectImageType(text('%PDF-1.7'))).toBeNull();
  });
});

describe('upload URL fields', () => {
  const pdf = '/api/uploads/0b6e0c4e-1111-4222-8333-944455556666.pdf';
  const png = '/api/uploads/0b6e0c4e-1111-4222-8333-944455556666.png';

  it('lets attachments be an uploaded PDF or an https link, never a script URL', () => {
    expect(documentUrlField.safeParse(pdf).success).toBe(true);
    expect(documentUrlField.safeParse('https://drive.example/doc.pdf').success).toBe(true);
    expect(documentUrlField.safeParse('').success).toBe(true);
    expect(documentUrlField.safeParse(png).success).toBe(false);
    expect(documentUrlField.safeParse('javascript:alert(1)').success).toBe(false);
    expect(documentUrlField.safeParse('/api/uploads/../../.env').success).toBe(false);
  });

  it('does not accept a PDF where an image is expected', () => {
    expect(imageUrlField.safeParse(pdf).success).toBe(false);
    expect(imageUrlField.safeParse(png).success).toBe(true);
  });

  it('is what the resolution form uses for attachments', () => {
    expect(resolutionFormSchema.shape.attachmentUrl.safeParse(pdf).success).toBe(true);
  });
});

describe('toCsv', () => {
  it('starts with a BOM, separates with semicolons and ends rows with CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('﻿a;b\r\n1;2\r\n');
  });

  it('quotes separators, quotes and line breaks', () => {
    expect(toCsv([['Kowalski; Jan', 'say "hi"', 'two\nlines']])).toBe(
      '﻿"Kowalski; Jan";"say ""hi""";"two\nlines"\r\n',
    );
  });

  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(toCsv([['=HYPERLINK("http://evil")', '+1', '-2', '@SUM(A1)']])).toBe(
      '﻿"\'=HYPERLINK(""http://evil"")";\'+1;\'-2;\'@SUM(A1)\r\n',
    );
  });
});
