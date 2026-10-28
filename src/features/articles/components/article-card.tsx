import { Newspaper } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import type { ArticleCardData } from '../queries';

export async function ArticleCard({ article, locale }: { article: ArticleCardData; locale: Locale }) {
  const t = await getTranslations('articles');
  const format = await getFormatter();
  const isFallback = article.contentLocale !== locale;

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        {article.heroImageUrl ? (
          // Plain <img>: uploads are auth-gated, so the Next image optimizer (no cookies) can't fetch them.
          <img
            src={article.heroImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-accent to-secondary text-primary/40">
            <Newspaper className="size-10" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5" lang={isFallback ? article.contentLocale : undefined}>
        <p className="text-xs text-muted-foreground">
          <time dateTime={article.publishedAt.toISOString()}>{format.dateTime(article.publishedAt, { dateStyle: 'long' })}</time>
          {' · '}
          {article.authorName ?? t('unknownAuthor')}
        </p>
        <h2 className="line-clamp-2 text-lg leading-snug font-semibold group-hover:text-primary">{article.title}</h2>
        <p className="line-clamp-3 text-sm text-muted-foreground">{article.summary}</p>
        {isFallback && (
          <Badge variant="muted" className="mt-auto uppercase">
            {article.contentLocale}
          </Badge>
        )}
      </div>
    </Link>
  );
}
