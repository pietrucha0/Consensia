'use client';

import { Loader2, Lock, Play, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type MouseEvent } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import {
  closeResolutionAction,
  deleteResolutionAction,
  openResolutionAction,
  type ResolutionActionError,
  type ResolutionActionResult,
} from '../actions';

type Kind = 'open' | 'close' | 'delete';

const CONFIG: Record<
  Kind,
  {
    action: (input: unknown) => Promise<ResolutionActionResult>;
    icon: LucideIcon;
    notice: 'opened' | 'closed' | 'deleted';
    destructive: boolean;
  }
> = {
  open: { action: openResolutionAction, icon: Play, notice: 'opened', destructive: false },
  close: { action: closeResolutionAction, icon: Lock, notice: 'closed', destructive: true },
  delete: { action: deleteResolutionAction, icon: Trash2, notice: 'deleted', destructive: true },
};

/** Irreversible lifecycle step, always behind a confirmation that states what becomes final. */
export function LifecycleButton({ kind, id, title }: { kind: Kind; id: string; title: string }) {
  const t = useTranslations('admin.resolutions');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ResolutionActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const { action, icon: Icon, notice, destructive } = CONFIG[kind];

  const confirm = (event: MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await action({ id });
      if (result.ok) {
        setOpen(false);
        router.replace({ pathname: '/admin/resolutions', query: { notice } });
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={kind === 'open' ? 'outline' : 'ghost'}
          size="sm"
          className={cn(kind === 'delete' && 'text-destructive hover:bg-destructive-soft hover:text-destructive')}
        >
          <Icon aria-hidden />
          <span className={cn(kind === 'delete' && 'sr-only lg:not-sr-only')}>{t(kind)}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${kind}Title`)}</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === 'delete' ? t('deleteBody', { title }) : t(`${kind}Body`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {kind !== 'delete' && <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">{title}</p>}
        {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={pending}
            className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t(kind)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
