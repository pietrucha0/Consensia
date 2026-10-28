import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { buttonVariants } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type Props = {
  page: number;
  pageCount: number;
  /** Current query (without `page`) to carry over. */
  query: Record<string, string>;
  /** Page being paginated (defaults to the article feed). */
  pathname?: string;
};

export async function Pagination({ page, pageCount, query, pathname = '/' }: Props) {
  if (pageCount <= 1) return null;
  const t = await getTranslations('articles');

  const hrefFor = (target: number) => ({
    pathname,
    query: target > 1 ? { ...query, page: String(target) } : query,
  });
  const disabled = 'pointer-events-none opacity-50';

  return (
    <nav aria-label={t('pageOf', { page, total: pageCount })} className="flex items-center justify-between gap-4">
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={cn(buttonVariants({ variant: 'outline' }), page <= 1 && disabled)}
      >
        <ChevronLeft aria-hidden />
        {t('previous')}
      </Link>
      <p className="text-sm text-muted-foreground">{t('pageOf', { page, total: pageCount })}</p>
      <Link
        href={hrefFor(page + 1)}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        className={cn(buttonVariants({ variant: 'outline' }), page >= pageCount && disabled)}
      >
        {t('next')}
        <ChevronRight aria-hidden />
      </Link>
    </nav>
  );
}
