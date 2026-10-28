import { ArrowDown, ArrowLeft, Eye, FileText, Languages } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Ballot } from '@/features/resolutions/components/ballot';
import { LiveRefresh } from '@/features/resolutions/components/live-refresh';
import { StatusBand } from '@/features/resolutions/components/status-band';
import { getResolutionForMember } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { getSession, verifySession } from '@/lib/dal';
import { cn } from '@/lib/utils';

type Props = { params: Promise<{ locale: string; id: string }> };

const isEditor = (role: string) => role === 'ADMIN' || role === 'MODERATOR';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session || !isLocale(locale)) return {};
  const resolution = await getResolutionForMember(id, locale, session.user.id, { includeDrafts: isEditor(session.user.role) });
  return resolution ? { title: resolution.title } : {};
}

export default async function ResolutionPage({ params }: Props) {
  const session = await verifySession();
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const resolution = await getResolutionForMember(id, locale, session.user.id, {
    includeDrafts: isEditor(session.user.role),
  });
  if (!resolution) notFound();

  const [t, tLocales] = await Promise.all([getTranslations('resolutions'), getTranslations('locales')]);
  const isFallback = resolution.contentLocale !== locale;
  const paragraphs = resolution.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // Live results only while voting is open and the viewer can already see them.
  const live = resolution.status === 'ACTIVE' && resolution.results !== null;

  return (
    <article className="mx-auto grid max-w-4xl gap-6" lang={isFallback ? resolution.contentLocale : undefined}>
      {live && <LiveRefresh />}

      <Link href="/resolutions" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t('back')}
      </Link>

      {resolution.status === 'DRAFT' && (
        <Alert variant="warning">
          <Eye />
          <AlertDescription>{t('draftPreview')}</AlertDescription>
        </Alert>
      )}
      {isFallback && (
        <Alert>
          <Languages />
          <AlertDescription>{t('fallbackNotice', { language: tLocales(resolution.contentLocale) })}</AlertDescription>
        </Alert>
      )}

      <StatusBand
        status={resolution.status}
        reference={resolution.reference}
        closesAt={resolution.closesAt}
        closedAt={resolution.closedAt}
        results={resolution.results}
      />

      <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{resolution.title}</h1>

      <section aria-labelledby="ballot-heading" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ballot-heading" className="text-lg font-semibold">
            {resolution.results ? t('resultsTitle') : t('ballotTitle')}
          </h2>
          <a
            href="#justification"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <ArrowDown className="size-4" aria-hidden />
            {t('justification')}
          </a>
        </div>
        <Ballot
          resolutionId={resolution.id}
          options={resolution.options}
          canVote={resolution.canVote}
          viewerVote={resolution.viewerVote}
          results={resolution.results}
          isClosed={resolution.status === 'CLOSED'}
        />
      </section>

      <section id="justification" aria-labelledby="justification-heading" className="grid scroll-mt-6 gap-4 border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="justification-heading" className="text-lg font-semibold">
            {t('justification')}
          </h2>
          {resolution.attachmentUrl && (
            <a
              href={resolution.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <FileText aria-hidden />
              {t('attachment')}
            </a>
          )}
        </div>
        {resolution.imageUrl && (
          <figure className="overflow-hidden rounded-xl border bg-muted">
            <img src={resolution.imageUrl} alt="" className="max-h-[28rem] w-full object-cover" />
          </figure>
        )}
        <div className="grid max-w-[70ch] gap-4 leading-relaxed">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    </article>
  );
}
