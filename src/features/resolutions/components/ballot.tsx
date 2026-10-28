'use client';

import { Check, CircleAlert, CircleCheck, Loader2, Vote } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState, useTransition } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { castVoteAction, type VoteError } from '../actions';
import type { ResolutionResults } from '../queries';

type Props = {
  resolutionId: string;
  options: { id: string; label: string }[];
  canVote: boolean;
  viewerVote: { optionId: string; castAt: Date } | null;
  results: ResolutionResults | null;
  isClosed: boolean;
};

/**
 * One grid, two states. Before the vote: equal, achromatic option tiles (a native radio
 * group, so arrow keys work) and a confirm step. After the vote — or once closed — the
 * same tiles, in the same positions, become result rows whose bars grow from zero.
 */
export function Ballot({ resolutionId, options, canVote, viewerVote, results, isClosed }: Props) {
  const t = useTranslations('resolutions');
  const format = useFormatter();
  const router = useRouter();
  const groupName = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<VoteError | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedLabel = options.find((o) => o.id === selected)?.label ?? '';

  const submit = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await castVoteAction({ resolutionId, optionId: selected });
      setConfirmOpen(false);
      if (!result.ok) setError(result.error);
      // Success and "already voted"/"closed" alike: re-render from the server's truth.
      router.refresh();
    });
  };

  if (results) {
    const chosen = viewerVote ? options.find((o) => o.id === viewerVote.optionId)?.label : undefined;
    return (
      <div className="grid gap-4">
        {/* e.g. a second tab tried to vote after the first one already did: say why its choice is not shown. */}
        {error && (
          <Alert variant="warning">
            <CircleAlert />
            <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
          </Alert>
        )}
        {viewerVote && chosen && (
          <Alert variant="success">
            <CircleCheck />
            <AlertTitle>{t('votedTitle')}</AlertTitle>
            <AlertDescription>
              {t('votedBody', { option: chosen, date: format.dateTime(viewerVote.castAt, { dateStyle: 'long', timeStyle: 'short' }) })}
            </AlertDescription>
          </Alert>
        )}
        {!viewerVote && isClosed && <p className="text-sm text-muted-foreground">{t('notVoted')}</p>}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isClosed ? t('resultsFinal') : t('resultsLive')}
        </p>
        <ResultGrid options={options} results={results} ownOptionId={viewerVote?.optionId ?? null} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p id={`${groupName}-hint`} className="text-sm text-muted-foreground">
        {t('ballotHint')}
      </p>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!canVote || pending} aria-describedby={`${groupName}-hint`} className="min-w-0">
        <legend className="sr-only">{t('ballotTitle')}</legend>
        <div className={gridClass(options.length)}>
          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  'relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border bg-card px-4 py-4 text-center text-base font-medium shadow-xs transition-colors sm:min-h-24 sm:py-5',
                  'hover:border-input has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40',
                  'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                  isSelected && 'border-primary bg-accent text-accent-foreground ring-1 ring-primary',
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option.id}
                  checked={isSelected}
                  onChange={() => {
                    setSelected(option.id);
                    setError(null);
                  }}
                  className="sr-only"
                />
                {isSelected && <Check className="absolute top-2.5 right-2.5 size-4 text-primary" aria-hidden />}
                <span className="text-balance">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canVote || !selected || pending} onClick={() => setConfirmOpen(true)}>
          <Vote aria-hidden />
          {t('castVote')}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmBody', { option: selectedLabel })}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-lg border border-primary bg-accent px-4 py-3 text-center text-lg font-semibold text-accent-foreground">
            {selectedLabel}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'default' })}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault(); // stay open until the server answers
                submit();
              }}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function gridClass(count: number): string {
  // Up to 3 options share one row on desktop; more wrap into equal columns.
  return cn('grid gap-3', count <= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3', count === 2 && 'sm:grid-cols-2');
}

function ResultGrid({
  options,
  results,
  ownOptionId,
}: {
  options: { id: string; label: string }[];
  results: ResolutionResults;
  ownOptionId: string | null;
}) {
  const t = useTranslations('resolutions');
  const format = useFormatter();
  // Bars start at zero and grow once mounted (the in-place morph from ballot to results).
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const byId = new Map(results.options.map((o) => [o.id, o]));

  return (
    <ul className={gridClass(options.length)}>
      {options.map((option) => {
        const row = byId.get(option.id) ?? { votes: 0, percentage: 0 };
        const own = option.id === ownOptionId;
        return (
          <li
            key={option.id}
            className={cn(
              'flex min-h-24 flex-col justify-between gap-3 rounded-lg border bg-card px-4 py-4 shadow-xs',
              own && 'border-primary ring-1 ring-primary',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium text-balance">{option.label}</span>
              {own && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  <Check className="size-3.5" aria-hidden />
                  {t('yourChoice')}
                </span>
              )}
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2 tabular-nums">
                <span className="text-2xl font-semibold tracking-tight">
                  {format.number(row.percentage / 100, { style: 'percent', maximumFractionDigits: 1 })}
                </span>
                <span className="text-sm text-muted-foreground">{t('votes', { count: row.votes })}</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={row.percentage}
                aria-label={option.label}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
                    own ? 'bg-primary' : 'bg-slate-500',
                  )}
                  style={{ width: grown ? `${row.percentage}%` : '0%' }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
