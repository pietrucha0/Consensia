import { Check, ChevronRight, CircleDot } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { listResolutions, type ResolutionListItem } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
import { isLocale, type Locale } from '@/i18n/routing';
import { verifySession } from '@/lib/dal';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('resolutions');
  return { title: t('title') };
}

export default async function ResolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const session = await verifySession();
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [items, t] = await Promise.all([listResolutions(locale, session.user.id), getTranslations('resolutions')]);
  const active = items.filter((r) => r.status === 'ACTIVE');
  const closed = items.filter((r) => r.status === 'CLOSED');

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <ResolutionSection heading={t('sectionActive')} empty={t('emptyActive')} items={active} locale={locale} />
      <ResolutionSection heading={t('sectionClosed')} empty={t('emptyClosed')} items={closed} locale={locale} />
    </div>
  );
}

async function ResolutionSection({
  heading,
  empty,
  items,
  locale,
}: {
  heading: string;
  empty: string;
  items: ResolutionListItem[];
  locale: Locale;
}) {
  const [t, format] = await Promise.all([getTranslations('resolutions'), getFormatter()]);
  const date = (d: Date) => format.dateTime(d, { dateStyle: 'long', timeStyle: 'short' });

  return (
    <section className="grid gap-3" aria-label={heading}>
      <h2 className="text-lg font-semibold">
        {heading} <span className="font-normal text-muted-foreground tabular-nums">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {items.map((item) => {
            const awaiting = item.status === 'ACTIVE' && !item.viewerVoted;
            const when =
              item.status === 'CLOSED' && item.closedAt
                ? t('closedOn', { date: date(item.closedAt) })
                : item.closesAt
                  ? t('closesOn', { date: date(item.closesAt) })
                  : t('noDeadline');
            return (
              <li key={item.id}>
                <Link
                  href={`/resolutions/${item.id}`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-5"
                >
                  <div className="grid min-w-0 flex-1 gap-1" lang={item.contentLocale !== locale ? item.contentLocale : undefined}>
                    <p className="font-medium text-balance group-hover:text-primary">
                      {item.reference && <span className="mr-2 text-muted-foreground tabular-nums">{item.reference}</span>}
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{when}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                      awaiting ? 'border-primary/30 bg-accent text-accent-foreground' : 'border-border text-muted-foreground',
                    )}
                  >
                    {awaiting ? <CircleDot className="size-3.5" aria-hidden /> : item.viewerVoted && <Check className="size-3.5" aria-hidden />}
                    {awaiting ? t('awaitingVote') : item.viewerVoted ? t('youVoted') : t('notVoted')}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
