import { CalendarClock, CircleCheck, CircleDot, Lock, Users } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import type { ResolutionStatus } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils';

import type { ResolutionResults } from '../queries';

type Props = {
  status: ResolutionStatus;
  reference: string | null;
  closesAt: Date | null;
  closedAt: Date | null;
  /** null while results are hidden from this viewer. */
  results: ResolutionResults | null;
};

// Emerald is reserved for the committed action and the viewer's own choice (direction
// contract): the state reads through its icon colour, the pill itself stays neutral.
const STATE_STYLES: Record<ResolutionStatus, string> = {
  ACTIVE: 'border-border bg-card text-foreground [&>svg]:text-primary',
  CLOSED: 'border-border bg-muted text-foreground [&>svg]:text-muted-foreground',
  DRAFT: 'border-warning/25 bg-warning-soft text-warning',
};

const STATE_ICONS = { ACTIVE: CircleDot, CLOSED: Lock, DRAFT: CircleCheck } as const;

/** The state of the vote in one line: what, until when, and (once voted) how many took part. */
export async function StatusBand({ status, reference, closesAt, closedAt, results }: Props) {
  const [t, format] = await Promise.all([getTranslations('resolutions'), getFormatter()]);
  const StateIcon = STATE_ICONS[status];
  const dateTime = (d: Date) => format.dateTime(d, { dateStyle: 'long', timeStyle: 'short' });

  const deadline =
    status === 'CLOSED' && closedAt
      ? t('closedOn', { date: dateTime(closedAt) })
      : closesAt
        ? t('closesOn', { date: dateTime(closesAt) })
        : t('noDeadline');

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium', STATE_STYLES[status])}>
          <StateIcon className="size-4" aria-hidden />
          {t(`status.${status}`)}
        </span>
        {reference && <span className="font-medium tabular-nums">{t('reference', { reference })}</span>}
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden />
          {closesAt || closedAt ? (
            <time dateTime={(status === 'CLOSED' && closedAt ? closedAt : closesAt)?.toISOString()}>{deadline}</time>
          ) : (
            deadline
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap sm:justify-end">
        <Users className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-muted-foreground">{t('turnout')}</span>
        {results ? (
          <span className="font-semibold tabular-nums">
            {t('turnoutValue', { voted: results.totalVotes, eligible: results.eligibleVoters })}
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({format.number(results.eligibleVoters === 0 ? 0 : results.totalVotes / results.eligibleVoters, { style: 'percent', maximumFractionDigits: 1 })})
            </span>
          </span>
        ) : (
          // Masked, not merely hidden: the numbers are never sent before the viewer votes.
          <span className="font-semibold tracking-widest text-muted-foreground tabular-nums" title={t('hiddenUntilVote')}>
            <span aria-hidden>–– / ––</span>
            <span className="sr-only">{t('hiddenUntilVote')}</span>
          </span>
        )}
      </div>
    </div>
  );
}
