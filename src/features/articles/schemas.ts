import { z } from 'zod';

import { routing, type Locale } from '@/i18n/routing';
import { imageUrlField } from '@/lib/image-url';

import { isRichTextEmpty, parseRichText, RICH_TEXT_MAX_BYTES } from './rich-text';

// ── Reader: URL search params (?q=&sort=&from=&to=&page=) ─────────────────────

export const ARTICLE_SORTS = ['newest', 'oldest'] as const;
export type ArticleSort = (typeof ARTICLE_SORTS)[number];
export const ARTICLES_PAGE_SIZE = 12;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

/** Never throws: malformed params fall back to defaults instead of erroring the page. */
export const articleSearchParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(ARTICLE_SORTS).catch('newest'),
  from: isoDay.optional().catch(undefined),
  to: isoDay.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ArticleSearchParams = z.output<typeof articleSearchParamsSchema>;

// ── CMS form ──────────────────────────────────────────────────────────────────

export const ARTICLE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 160;

const translationFormSchema = z.object({
  title: z.string().trim().max(200, { error: 'tooLong' }),
  summary: z.string().trim().max(500, { error: 'tooLong' }),
  heroImageAlt: z.string().trim().max(300, { error: 'tooLong' }),
  footer: z.string().trim().max(5000, { error: 'tooLong' }),
  /** Tiptap JSON (or null when empty) — validated against the rich-text schema below. */
  body: z.unknown(),
});

export const articleFormSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, { error: 'required' })
      .max(SLUG_MAX_LENGTH, { error: 'tooLong' })
      .regex(SLUG_PATTERN, { error: 'slugInvalid' }),
    status: z.enum(ARTICLE_STATUSES),
    heroImageUrl: imageUrlField,
    translations: z.object({
      en: translationFormSchema,
      pl: translationFormSchema,
      es: translationFormSchema,
      fr: translationFormSchema,
    }),
  })
  .superRefine((data, ctx) => {
    let filled = 0;
    for (const locale of routing.locales) {
      const t = data.translations[locale];
      const body = parseRichText(t.body);
      const started = t.title !== '' || t.summary !== '' || t.footer !== '' || t.heroImageAlt !== '' || !isRichTextEmpty(body);
      if (!started) continue;
      filled += 1;

      const issue = (field: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: ['translations', locale, field], message });
      if (t.title === '') issue('title', 'titleRequired');
      if (t.summary === '') issue('summary', 'summaryRequired');
      if (t.body !== null && t.body !== undefined && body === null) issue('body', 'bodyInvalid');
      else if (isRichTextEmpty(body)) issue('body', 'bodyRequired');
      else if (JSON.stringify(body).length > RICH_TEXT_MAX_BYTES) issue('body', 'tooLong');
    }
    if (filled === 0) ctx.addIssue({ code: 'custom', path: ['translations'], message: 'translationRequired' });
  });

export type ArticleFormValues = z.input<typeof articleFormSchema>;
export type ArticleFormTranslation = ArticleFormValues['translations'][Locale];

export const emptyArticleTranslation = (): ArticleFormTranslation => ({
  title: '',
  summary: '',
  heroImageAlt: '',
  footer: '',
  body: null,
});

export const emptyArticleForm = (): ArticleFormValues => ({
  slug: '',
  status: 'DRAFT',
  heroImageUrl: '',
  translations: {
    en: emptyArticleTranslation(),
    pl: emptyArticleTranslation(),
    es: emptyArticleTranslation(),
    fr: emptyArticleTranslation(),
  },
});

/** "Zażółć gęślą jaźń — 2026!" → "zazolc-gesla-jazn-2026" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}
