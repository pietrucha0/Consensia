'use client';

import { Loader2 } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import type { Role } from '@/generated/prisma/enums';
import { useRouter } from '@/i18n/navigation';

import { changeUserRoleAction, type UserActionError } from '../actions';
import { ROLES } from '../schemas';

type Props = { userId: string; memberLabel: string; role: Role; isSelf: boolean };

/** Role picker; every change goes through a confirmation, since roles grant real powers. */
export function MemberRoleSelect({ userId, memberLabel, role, isSelf }: Props) {
  const t = useTranslations('admin.users');
  const tRole = useTranslations('dashboard.role');
  const router = useRouter();
  const [requested, setRequested] = useState<Role | null>(null);
  const [error, setError] = useState<UserActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = (event: MouseEvent) => {
    event.preventDefault();
    if (!requested) return;
    startTransition(async () => {
      const result = await changeUserRoleAction({ userId, role: requested });
      if (result.ok) {
        setRequested(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <NativeSelect
        aria-label={t('roleFor', { member: memberLabel })}
        value={role}
        disabled={isSelf || pending}
        title={isSelf ? t('selfHint') : undefined}
        onChange={(e) => {
          const next = ROLES.find((r) => r === e.target.value);
          if (next && next !== role) {
            setError(null);
            setRequested(next);
          }
        }}
        className="h-9 min-w-36"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {tRole(r)}
          </option>
        ))}
      </NativeSelect>

      <AlertDialog open={requested !== null} onOpenChange={(open) => !open && !pending && setRequested(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('roleConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roleConfirmBody', {
                member: memberLabel,
                from: tRole(role),
                to: requested ? tRole(requested) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requested && <p className="text-sm text-muted-foreground">{t(`roleEffect.${requested}`)}</p>}
          {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t('roleConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
