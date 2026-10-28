'use client';

import { Loader2, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { setUserDisabledAction, type UserActionError } from '../actions';

type Props = { userId: string; memberLabel: string; disabled: boolean; isSelf: boolean };

export function MemberStatusButton({ userId, memberLabel, disabled, isSelf }: Props) {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<UserActionError | null>(null);
  const [pending, startTransition] = useTransition();

  if (isSelf) return null;

  const confirm = (event: MouseEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await setUserDisabledAction({ userId, disabled: !disabled });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const verb = disabled ? 'enable' : 'disable';

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
          variant="ghost"
          size="sm"
          className={disabled ? undefined : 'text-destructive hover:bg-destructive-soft hover:text-destructive'}
        >
          {disabled ? <LockKeyholeOpen aria-hidden /> : <LockKeyhole aria-hidden />}
          <span className="sr-only lg:not-sr-only">{t(`${verb}.action`)}</span>
          <span className="sr-only">{memberLabel}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${verb}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>{t(`${verb}.body`, { member: memberLabel })}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t(`${verb}.confirm`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
