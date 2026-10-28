import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ArticleCard } from '@/features/articles/components/article-card';
import { ArticleFilters } from '@/features/articles/components/article-filters';
import { Pagination } from '@/components/layout/pagination';
import { listPublishedArticles } from '@/features/articles/queries';
import { articleSearchParamsSchema } from '@/features/articles/schemas';
import { isLocale } from '@/i18n/routing';
import { verifySession } from '@/lib/dal';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('articles');
  return { title: t('title') };
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
};

/** Home: the article feed. */
export default async function ArticlesPage({ params, searchParams }: Props) {
  await verifySession();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const raw = await searchParams;
  const filters = articleSearchParamsSchema.parse({
    q: firstParam(raw.q),
    sort: firstParam(raw.sort),
    from: firstParam(raw.from),
    to: firstParam(raw.to),
    page: firstParam(raw.page),
  });

  const [{ items, total, page, pageCount }, t] = await Promise.all([
    listPublishedArticles(filters, locale),
    getTranslations('articles'),
  ]);

  const hasFilters = Boolean(filters.q || filters.from || filters.to);
  const carriedQuery: Record<string, string> = {};
  if (filters.q) carriedQuery.q = filters.q;
  if (filters.sort !== 'newest') carriedQuery.sort = filters.sort;
  if (filters.from) carriedQuery.from = filters.from;
  if (filters.to) carriedQuery.to = filters.to;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Suspense>
        <ArticleFilters />
      </Suspense>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('resultCount', { count: total })}
      </p>

      {items.length > 0 ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((article) => (
            <li key={article.id} className="flex">
              <ArticleCard article={article} locale={locale} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
          {hasFilters ? t('empty') : t('emptyNone')}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} query={carriedQuery} />
    </div>
  );
}
