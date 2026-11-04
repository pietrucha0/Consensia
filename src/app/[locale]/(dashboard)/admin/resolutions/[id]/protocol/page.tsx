import { ArrowLeft, Download } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PrintButton } from '@/components/layout/print-button';
import { Button } from '@/components/ui/button';
import { getResolutionProtocol } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { requireRole } from '@/lib/dal';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations('admin.resolutions.protocol');
  if (!isLocale(locale)) return { title: t('title') };
  const protocol = await getResolutionProtocol(id, locale);
  return { title: protocol?.reference ? `${t('title')} ${protocol.reference}` : t('title') };
}

/** Printable record of a closed resolution (A4 via the browser's "Save as PDF"). */
export default async function ResolutionProtocolPage({ params }: Props) {
  await requireRole(['ADMIN', 'MODERATOR']);
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const [protocol, t, format] = await Promise.all([
    getResolutionProtocol(id, locale),
    getTranslations('admin.resolutions.protocol'),
    getFormatter(),
  ]);
  if (!protocol) notFound();

  const when = (d: Date) => format.dateTime(d, { dateStyle: 'long', timeStyle: 'short' });
  const labelOf = new Map(protocol.options.map((o) => [o.id, o.label]));
  const { results } = protocol;
  const turnout = results.eligibleVoters === 0 ? 0 : Math.round((results.totalVotes / results.eligibleVoters) * 1000) / 10;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 print:max-w-none print:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/resolutions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('back')}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/resolutions/${protocol.id}/votes?locale=${locale}`} download>
              <Download aria-hidden />
              {t('downloadCsv')}
            </a>
          </Button>
          <PrintButton label={t('print')} />
        </div>
      </div>

      <article className="grid gap-6 rounded-xl border bg-card p-6 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="grid gap-2 border-b pb-4">
          <p className="text-sm text-muted-foreground">{t('heading')}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {protocol.reference && <span className="mr-2 tabular-nums">{protocol.reference}</span>}
            {protocol.title}
          </h1>
        </header>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('opened')}</dt>
            <dd className="font-medium">{when(protocol.openedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('closed')}</dt>
            <dd className="font-medium">{when(protocol.closedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('deadline')}</dt>
            <dd className="font-medium">{protocol.closesAt ? when(protocol.closesAt) : t('noDeadline')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('preparedBy')}</dt>
            <dd className="font-medium">{protocol.createdBy ?? '—'}</dd>
          </div>
        </dl>

        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">{t('justification')}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{protocol.description}</p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t('results')}</h2>
          <p className="text-sm">
            {t('turnout', { votes: results.totalVotes, eligible: results.eligibleVoters, percent: turnout })}
          </p>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="py-2 font-medium">{t('colOption')}</th>
                <th scope="col" className="py-2 text-right font-medium">{t('colVotes')}</th>
                <th scope="col" className="py-2 text-right font-medium">{t('colShare')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.options.map((option) => (
                <tr key={option.id}>
                  <td className="py-2 font-medium">{labelOf.get(option.id)}</td>
                  <td className="py-2 text-right tabular-nums">{option.votes}</td>
                  <td className="py-2 text-right tabular-nums">{format.number(option.percentage / 100, { style: 'percent', maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-3 print:break-before-auto">
          <h2 className="text-lg font-semibold">{t('votesHeading', { count: protocol.votes.length })}</h2>
          {protocol.votes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noVotes')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-2 font-medium">#</th>
                  <th scope="col" className="py-2 pr-2 font-medium">{t('colMember')}</th>
                  <th scope="col" className="py-2 pr-2 font-medium">{t('colChoice')}</th>
                  <th scope="col" className="py-2 font-medium">{t('colCastAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {protocol.votes.map((vote, index) => (
                  <tr key={`${vote.email}-${vote.castAt.toISOString()}`} className="break-inside-avoid">
                    <td className="py-2 pr-2 text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{vote.name ?? vote.email}</span>
                      {vote.name && <span className="block text-xs text-muted-foreground">{vote.email}</span>}
                    </td>
                    <td className="py-2 pr-2">{labelOf.get(vote.optionId)}</td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                      {format.dateTime(vote.castAt, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="border-t pt-4 text-xs text-muted-foreground">
          {t('generated', { date: when(new Date()) })}
        </footer>
      </article>
    </div>
  );
}
