import { ArrowLeft, Eye, Languages } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { RichTextRenderer } from '@/features/articles/components/rich-text-renderer';
import { PROSE_CLASSES } from '@/features/articles/prose';
import { getArticleBySlug } from '@/features/articles/queries';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { getSession, verifySession } from '@/lib/dal';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  // Metadata renders in parallel with the page: never resolve content without a valid session.
  const session = await getSession();
  if (!session || !isLocale(locale)) return {};
  const article = await getArticleBySlug(slug, locale, { includeUnpublished: session.user.role === 'ADMIN' });
  return article ? { title: article.title, description: article.summary } : {};
}

export default async function ArticlePage({ params }: Props) {
  const session = await verifySession();
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const isAdmin = session.user.role === 'ADMIN';
  const article = await getArticleBySlug(slug, locale, { includeUnpublished: isAdmin });
  if (!article) notFound();

  const [t, tLocales, tAdmin, format] = await Promise.all([
    getTranslations('articles'),
    getTranslations('locales'),
    getTranslations('admin'),
    getFormatter(),
  ]);

  const isVisibleToReaders =
    article.status === 'PUBLISHED' && article.publishedAt !== null && article.publishedAt <= new Date();
  const isFallback = article.contentLocale !== locale;
  const showUpdated =
    article.publishedAt !== null && article.updatedAt.getTime() - article.publishedAt.getTime() > 60 * 60 * 1000;

  return (
    <article className="mx-auto grid max-w-3xl gap-6" lang={isFallback ? article.contentLocale : undefined}>
      <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t('back')}
      </Link>

      {!isVisibleToReaders && (
        <Alert variant="warning">
          <Eye />
          <AlertDescription>{t('previewNotice', { status: tAdmin(`status.${article.status}`) })}</AlertDescription>
        </Alert>
      )}
      {isFallback && (
        <Alert>
          <Languages />
          <AlertDescription>{t('fallbackNotice', { language: tLocales(article.contentLocale) })}</AlertDescription>
        </Alert>
      )}

      {article.heroImageUrl && (
        <figure className="overflow-hidden rounded-xl border bg-muted">
          <img src={article.heroImageUrl} alt={article.heroImageAlt ?? ''} className="aspect-[16/9] w-full object-cover" />
        </figure>
      )}

      <header className="grid gap-3">
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{article.title}</h1>
        <p className="text-sm text-muted-foreground">
          {article.authorName ?? t('unknownAuthor')}
          {article.publishedAt && (
            <>
              {' · '}
              <time dateTime={article.publishedAt.toISOString()}>{format.dateTime(article.publishedAt, { dateStyle: 'long' })}</time>
            </>
          )}
          {showUpdated && (
            <>
              {' · '}
              {t('updatedOn', { date: format.dateTime(article.updatedAt, { dateStyle: 'long' }) })}
            </>
          )}
        </p>
        <p className="text-lg leading-relaxed text-muted-foreground">{article.summary}</p>
      </header>

      {article.body && (
        <div className={PROSE_CLASSES}>
          <RichTextRenderer doc={article.body} />
        </div>
      )}

      {article.footer && (
        <footer className="border-t pt-6 text-sm whitespace-pre-line text-muted-foreground">{article.footer}</footer>
      )}
    </article>
  );
}
