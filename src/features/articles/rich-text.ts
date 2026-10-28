import { z } from 'zod';

/**
 * Article body format: an allow-listed subset of Tiptap/ProseMirror JSON.
 * Every write is validated against this schema (unknown nodes/attrs are rejected
 * or stripped), and the reader renders it with a React renderer — never raw HTML.
 */

export type RichTextMark =
  | { type: 'bold' | 'italic' | 'underline' | 'strike' }
  | { type: 'link'; attrs: { href: string } };

export type RichTextInline = { type: 'text'; text: string; marks?: RichTextMark[] | undefined } | { type: 'hardBreak' };

export type RichTextListItem = { type: 'listItem'; content: RichTextBlock[] };

export type RichTextBlock =
  | { type: 'paragraph'; content?: RichTextInline[] | undefined }
  | { type: 'heading'; attrs: { level: 2 | 3 }; content?: RichTextInline[] | undefined }
  | { type: 'blockquote'; content: RichTextBlock[] }
  | { type: 'bulletList'; content: RichTextListItem[] }
  | { type: 'orderedList'; attrs?: { start?: number | undefined } | undefined; content: RichTextListItem[] }
  | { type: 'horizontalRule' };

export type RichTextDoc = { type: 'doc'; content: RichTextBlock[] };

/** Max serialized size of one body (per language). */
export const RICH_TEXT_MAX_BYTES = 200_000;

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function isSafeHref(href: string): boolean {
  try {
    return SAFE_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

const markSchema: z.ZodType<RichTextMark> = z.union([
  z.object({ type: z.enum(['bold', 'italic', 'underline', 'strike']) }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({ href: z.string().max(2048).refine(isSafeHref) }),
  }),
]);

const inlineSchema: z.ZodType<RichTextInline> = z.union([
  z.object({ type: z.literal('text'), text: z.string().min(1), marks: z.array(markSchema).optional() }),
  z.object({ type: z.literal('hardBreak') }),
]);

const listItemSchema: z.ZodType<RichTextListItem> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockSchema) }),
);

const blockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('paragraph'), content: z.array(inlineSchema).optional() }),
    z.object({
      type: z.literal('heading'),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: z.array(inlineSchema).optional(),
    }),
    z.object({ type: z.literal('blockquote'), content: z.array(blockSchema) }),
    z.object({ type: z.literal('bulletList'), content: z.array(listItemSchema) }),
    z.object({
      type: z.literal('orderedList'),
      attrs: z.object({ start: z.number().int().min(0).max(100_000).optional() }).optional(),
      content: z.array(listItemSchema),
    }),
    z.object({ type: z.literal('horizontalRule') }),
  ]),
);

export const richTextDocSchema: z.ZodType<RichTextDoc> = z.object({
  type: z.literal('doc'),
  content: z.array(blockSchema),
});

/** Validates a stored/submitted body. Returns null for anything that is not a valid document. */
export function parseRichText(value: unknown): RichTextDoc | null {
  const parsed = richTextDocSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Plain text of a document (search snippets, emptiness checks). */
export function richTextToPlainText(doc: RichTextDoc): string {
  const parts: string[] = [];
  const visitInline = (nodes: RichTextInline[] | undefined) => {
    for (const node of nodes ?? []) parts.push(node.type === 'text' ? node.text : ' ');
  };
  const visitBlocks = (blocks: RichTextBlock[]) => {
    for (const block of blocks) {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          visitInline(block.content);
          parts.push('\n');
          break;
        case 'blockquote':
          visitBlocks(block.content);
          break;
        case 'bulletList':
        case 'orderedList':
          for (const item of block.content) visitBlocks(item.content);
          break;
        case 'horizontalRule':
          break;
      }
    }
  };
  visitBlocks(doc.content);
  return parts.join('').trim();
}

export function isRichTextEmpty(doc: RichTextDoc | null): boolean {
  return doc === null || richTextToPlainText(doc).length === 0;
}
