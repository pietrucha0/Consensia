import 'server-only';

import { env } from '@/env';
import type { Prisma } from '@/generated/prisma/client';
import type { ArticleStatus } from '@/generated/prisma/enums';
import { pickTranslation } from '@/i18n/pick-translation';
import type { Locale } from '@/i18n/routing';
import { escapeLikePattern } from '@/lib/like-pattern';
import { prisma } from '@/lib/prisma';
import { startOfDayInTimeZone, startOfNextDayInTimeZone } from '@/lib/time-zone';

import { parseRichText, type RichTextDoc } from './rich-text';
import { ARTICLES_PAGE_SIZE, emptyArticleForm, type ArticleFormValues, type ArticleSearchParams } from './schemas';

/**
 * Callers are responsible for authorization (verifySession / requireRole) —
 * these functions only shape data.
 */

export type ArticleCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  publishedAt: Date;
  authorName: string | null;
  /** Language actually shown (differs from the reader's when falling back). */
  contentLocale: Locale;
};

const publishedNow = (): Prisma.ArticleWhereInput => ({
  status: 'PUBLISHED',
  publishedAt: { lte: new Date() },
});

export async function listPublishedArticles(
  params: ArticleSearchParams,
  locale: Locale,
): Promise<{ items: ArticleCardData[]; total: number; page: number; pageCount: number }> {
  // Scheduled articles (publishedAt in the future) stay hidden until their time.
  const publishedAt: Prisma.DateTimeNullableFilter = { lte: new Date() };
  if (params.from) publishedAt.gte = startOfDayInTimeZone(params.from, env.APP_TIME_ZONE);
  if (params.to) publishedAt.lt = startOfNextDayInTimeZone(params.to, env.APP_TIME_ZONE);

  const where: Prisma.ArticleWhereInput = {
    status: 'PUBLISHED',
    publishedAt,
    // ILIKE '%q%' — served by the GIN trigram index on article_translations.title.
    // Matches any language version, so a reader can find an article by its English title too.
    ...(params.q && {
      translations: { some: { title: { contains: escapeLikePattern(params.q), mode: 'insensitive' } } },
    }),
  };

  const direction = params.sort === 'oldest' ? 'asc' : 'desc';
  const total = await prisma.article.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);

  const rows = await prisma.article.findMany({
    where,
    orderBy: [{ publishedAt: direction }, { id: direction }],
    skip: (page - 1) * ARTICLES_PAGE_SIZE,
    take: ARTICLES_PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      heroImageUrl: true,
      publishedAt: true,
      author: { select: { name: true } },
      translations: { select: { locale: true, title: true, summary: true, heroImageAlt: true } },
    },
  });

  const items = rows.flatMap((row): ArticleCardData[] => {
    const t = pickTranslation(row.translations, locale);
    if (!t || !row.publishedAt) return [];
    return [
      {
        id: row.id,
        slug: row.slug,
        title: t.title,
        summary: t.summary,
        heroImageUrl: row.heroImageUrl,
        heroImageAlt: t.heroImageAlt,
        publishedAt: row.publishedAt,
        authorName: row.author?.name ?? null,
        contentLocale: t.locale,
      },
    ];
  });

  return { items, total, page, pageCount };
}

export type ArticleDetail = {
  id: string;
  slug: string;
  status: ArticleStatus;
  title: string;
  summary: string;
  body: RichTextDoc | null;
  footer: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  contentLocale: Locale;
};

/** Published article by slug; `includeUnpublished` lets admins preview drafts/archived ones. */
export async function getArticleBySlug(
  slug: string,
  locale: Locale,
  options: { includeUnpublished?: boolean } = {},
): Promise<ArticleDetail | null> {
  const article = await prisma.article.findFirst({
    where: { slug, ...(!options.includeUnpublished && publishedNow()) },
    select: {
      id: true,
      slug: true,
      status: true,
      heroImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      translations: {
        select: { locale: true, title: true, summary: true, body: true, footer: true, heroImageAlt: true },
      },
    },
  });
  if (!article) return null;

  const t = pickTranslation(article.translations, locale);
  if (!t) return null;

  return {
    id: article.id,
    slug: article.slug,
    status: article.status,
    title: t.title,
    summary: t.summary,
    body: parseRichText(t.body),
    footer: t.footer,
    heroImageUrl: article.heroImageUrl,
    heroImageAlt: t.heroImageAlt,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.author?.name ?? null,
    contentLocale: t.locale,
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AdminArticleRow = {
  id: string;
  slug: string;
  status: ArticleStatus;
  title: string;
  locales: Locale[];
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function listArticlesForAdmin(locale: Locale): Promise<AdminArticleRow[]> {
  const rows = await prisma.article.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      translations: { select: { locale: true, title: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: pickTranslation(row.translations, locale)?.title ?? row.slug,
    locales: row.translations.map((t) => t.locale),
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  }));
}

/** Form values for the editor, or null if the article doesn't exist. */
export async function getArticleForEdit(id: string): Promise<ArticleFormValues | null> {
  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      slug: true,
      status: true,
      heroImageUrl: true,
      translations: {
        select: { locale: true, title: true, summary: true, body: true, footer: true, heroImageAlt: true },
      },
    },
  });
  if (!article) return null;

  const values = emptyArticleForm();
  values.slug = article.slug;
  values.status = article.status;
  values.heroImageUrl = article.heroImageUrl ?? '';
  for (const t of article.translations) {
    values.translations[t.locale] = {
      title: t.title,
      summary: t.summary,
      heroImageAlt: t.heroImageAlt ?? '',
      footer: t.footer ?? '',
      body: parseRichText(t.body),
    };
  }
  return values;
}
