import { CircleCheck, ExternalLink, Pencil, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ResolutionStatus } from '@/generated/prisma/enums';
import { LifecycleButton } from '@/features/resolutions/components/lifecycle-button';
import { listResolutionsForAdmin } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { requireRole } from '@/lib/dal';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.resolutions');
  return { title: t('title') };
}

const NOTICES = ['created', 'opened', 'closed', 'deleted'] as const;
const STATUS_VARIANT = { ACTIVE: 'success', DRAFT: 'warning', CLOSED: 'muted' } as const satisfies Record<
  ResolutionStatus,
  'success' | 'warning' | 'muted'
>;

type Props = { params: Promise<{ locale: string }>; searchParams: SearchParams };

export default async function AdminResolutionsPage({ params, searchParams }: Props) {
  await requireRole(['ADMIN', 'MODERATOR']);
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [rows, t, tStatus, format] = await Promise.all([
    listResolutionsForAdmin(locale),
    getTranslations('admin.resolutions'),
    getTranslations('resolutions.status'),
    getFormatter(),
  ]);
  const noticeParam = firstParam((await searchParams).notice);
  const notice = NOTICES.find((n) => n === noticeParam);
  const date = (d: Date) => format.dateTime(d, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <Button asChild>
          <Link href="/admin/resolutions/new">
            <Plus aria-hidden />
            {t('new')}
          </Link>
        </Button>
      </header>

      {notice && (
        <Alert variant="success">
          <CircleCheck />
          <AlertDescription>{t(notice)}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">{t('empty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('colTitle')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colStatus')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('colVotes')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colDeadline')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="align-middle hover:bg-muted/30">
                  <td className="max-w-96 px-4 py-3">
                    <p className="line-clamp-2 font-medium">
                      {row.reference && <span className="mr-2 text-muted-foreground tabular-nums">{row.reference}</span>}
                      {row.title}
                    </p>
                    <div className="mt-1 flex gap-1">
                      {row.locales.map((l) => (
                        <Badge key={l} variant="outline" className="uppercase">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[row.status]}>{tStatus(row.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.status === 'DRAFT' ? '—' : row.voteCount}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {row.status === 'CLOSED' && row.closedAt ? date(row.closedAt) : row.closesAt ? date(row.closesAt) : t('noDeadline')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/resolutions/${row.id}`} title={t('view')}>
                          <ExternalLink aria-hidden />
                          <span className="sr-only xl:not-sr-only">{t('view')}</span>
                        </Link>
                      </Button>
                      {row.status === 'DRAFT' && (
                        <>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/resolutions/${row.id}/edit`}>
                              <Pencil aria-hidden />
                              <span className="sr-only xl:not-sr-only">{t('editAction')}</span>
                            </Link>
                          </Button>
                          <LifecycleButton kind="open" id={row.id} title={row.title} />
                          <LifecycleButton kind="delete" id={row.id} title={row.title} />
                        </>
                      )}
                      {row.status === 'ACTIVE' && <LifecycleButton kind="close" id={row.id} title={row.title} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
