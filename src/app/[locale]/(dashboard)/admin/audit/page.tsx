import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Pagination } from '@/components/layout/pagination';
import { buttonVariants } from '@/components/ui/button';
import { ARTICLE_STATUSES } from '@/features/articles/schemas';
import { AUDIT_CATEGORIES, auditDetails, auditFiltersSchema, listAuditLog } from '@/features/audit/queries';
import { ROLES } from '@/features/users/schemas';
import type { AuditAction } from '@/generated/prisma/enums';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';
import { firstParam, type SearchParams } from '@/lib/search-params';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.audit');
  return { title: t('title') };
}

type Props = { searchParams: SearchParams };


export default async function AuditLogPage({ searchParams }: Props) {
  await requireRole(['ADMIN']);
  const raw = await searchParams;
  const filters = auditFiltersSchema.parse({ category: firstParam(raw.category), page: firstParam(raw.page) });

  const [{ entries, pageCount }, t, tAdmin, tRole, format] = await Promise.all([
    listAuditLog(filters),
    getTranslations('admin.audit'),
    getTranslations('admin'),
    getTranslations('dashboard.role'),
    getFormatter(),
  ]);

  /** Role / status codes in `metadata` are shown with their translated names. */
  const valueLabel = (value: string | undefined): string => {
    if (!value) return '—';
    const role = ROLES.find((r) => r === value);
    if (role) return tRole(role);
    const status = ARTICLE_STATUSES.find((s) => s === value);
    if (status) return tAdmin(`status.${status}`);
    return value;
  };

  const describe = (action: AuditAction, metadata: unknown): string | null => {
    const details = auditDetails(metadata);
    if (details.reason === 'deadline') return t('details.deadline');
    if (details.from && details.to) return t('details.change', { from: valueLabel(details.from), to: valueLabel(details.to) });
    return action === 'RESOLUTION_CLOSED' ? t('details.manual') : null;
  };

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>

      <nav aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
        {AUDIT_CATEGORIES.map((category) => {
          const active = filters.category === category;
          return (
            <Link
              key={category}
              href={{ pathname: '/admin/audit', query: category === 'all' ? {} : { category } }}
              aria-current={active ? 'page' : undefined}
              className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }))}
            >
              {t(`category.${category}`)}
            </Link>
          );
        })}
      </nav>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('colWhen')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colWho')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colAction')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colTarget')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                    {format.dateTime(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="max-w-56 px-4 py-3">
                    {entry.actor ? (
                      <span className="block truncate">{entry.actor.name ?? entry.actor.email}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('system')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{t(`action.${entry.action}`)}</td>
                  <td className="max-w-72 px-4 py-3">
                    <span className="line-clamp-2">{entry.targetLabel ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{describe(entry.action, entry.metadata) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        query={filters.category === 'all' ? {} : { category: filters.category }}
        pathname="/admin/audit"
      />
    </div>
  );
}
