import { Search, X } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';

import { Pagination } from '@/components/layout/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { MemberRoleSelect } from '@/features/users/components/member-role-select';
import { MemberStatusButton } from '@/features/users/components/member-status-button';
import { listMembers, memberSummary, type MemberRow } from '@/features/users/queries';
import { ROLES, USER_STATUS_FILTERS, userListFiltersSchema } from '@/features/users/schemas';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.users');
  return { title: t('title') };
}

type Props = { searchParams: SearchParams };

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await requireRole(['ADMIN']);
  const raw = await searchParams;
  const filters = userListFiltersSchema.parse({
    q: firstParam(raw.q) ?? '',
    status: firstParam(raw.status),
    role: firstParam(raw.role),
    page: firstParam(raw.page),
  });

  const [{ members, total, pageCount }, summary, t, tRole, format] = await Promise.all([
    listMembers(filters),
    memberSummary(),
    getTranslations('admin.users'),
    getTranslations('dashboard.role'),
    getFormatter(),
  ]);

  const carriedQuery: Record<string, string> = {};
  if (filters.q) carriedQuery.q = filters.q;
  if (filters.status !== 'all') carriedQuery.status = filters.status;
  if (filters.role) carriedQuery.role = filters.role;
  const hasFilters = Object.keys(carriedQuery).length > 0;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('summary', { eligible: summary.eligible, unverified: summary.unverified, disabled: summary.disabled })}
        </p>
      </header>

      {/* Plain GET form: filters live in the URL and work without JavaScript. */}
      <form
        role="search"
        className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] md:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="member-search">{t('searchLabel')}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="member-search"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder={t('searchPlaceholder')}
              maxLength={100}
              className="pl-9"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="member-status">{t('statusLabel')}</Label>
          <NativeSelect id="member-status" name="status" defaultValue={filters.status}>
            {USER_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {t(`statusFilter.${status}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="member-role">{t('roleLabel')}</Label>
          <NativeSelect id="member-role" name="role" defaultValue={filters.role ?? ''}>
            <option value="">{t('allRoles')}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {tRole(role)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">
          <Search aria-hidden />
          {t('filter')}
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/admin/users">
              <X aria-hidden />
              {t('clearFilters')}
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" disabled>
            <X aria-hidden />
            {t('clearFilters')}
          </Button>
        )}
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('resultCount', { count: total })}
      </p>

      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('colMember')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colRole')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colStatus')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('colJoined')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('colVotes')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((member) => {
                const isSelf = member.id === session.user.id;
                const label = member.name ?? member.email;
                return (
                  <tr key={member.id} className="align-middle hover:bg-muted/30">
                    <td className="max-w-72 px-4 py-3">
                      <p className="truncate font-medium">
                        {label}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">{t('you')}</span>}
                      </p>
                      {member.name && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <MemberRoleSelect userId={member.id} memberLabel={label} role={member.role} isSelf={isSelf} />
                    </td>
                    <td className="px-4 py-3">
                      <MemberStatus member={member} labels={{
                        active: t('status.active'),
                        unverified: t('status.unverified'),
                        disabled: t('status.disabled'),
                        locked: t('status.locked'),
                      }} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {format.dateTime(member.createdAt, { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{member.voteCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <MemberStatusButton
                          userId={member.id}
                          memberLabel={label}
                          disabled={member.disabled}
                          isSelf={isSelf}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={filters.page} pageCount={pageCount} query={carriedQuery} pathname="/admin/users" />
    </div>
  );
}

function MemberStatus({
  member,
  labels,
}: {
  member: MemberRow;
  labels: Record<'active' | 'unverified' | 'disabled' | 'locked', string>;
}) {
  if (member.disabled) return <Badge variant="muted">{labels.disabled}</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {member.verified ? (
        <Badge variant="success">{labels.active}</Badge>
      ) : (
        <Badge variant="warning">{labels.unverified}</Badge>
      )}
      {member.lockedUntil && <Badge variant="outline">{labels.locked}</Badge>}
    </div>
  );
}
