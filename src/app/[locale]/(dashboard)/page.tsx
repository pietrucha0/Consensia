import { Vote } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Pagination } from '@/components/layout/pagination';
import { buttonVariants } from '@/components/ui/button';
import { ArticleCard } from '@/features/articles/components/article-card';
import { ArticleFilters } from '@/features/articles/components/article-filters';
import { listPublishedArticles } from '@/features/articles/queries';
import { articleSearchParamsSchema } from '@/features/articles/schemas';
import { countPendingVotes } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
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
  const session = await verifySession();
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

  const [{ items, total, page, pageCount }, t, tResolutions, pendingVotes] = await Promise.all([
    listPublishedArticles(filters, locale),
    getTranslations('articles'),
    getTranslations('resolutions'),
    countPendingVotes(session.user.id),
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

      {pendingVotes > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <p className="flex items-center gap-2 font-medium">
            <Vote className="size-4 shrink-0" aria-hidden />
            {tResolutions('pendingBanner', { count: pendingVotes })}
          </p>
          <Link href="/resolutions" className={buttonVariants({ size: 'sm' })}>
            {tResolutions('pendingCta')}
          </Link>
        </section>
      )}

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
