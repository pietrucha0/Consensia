'use client';

import { Loader2, MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { signOutOtherSessionsAction, type AccountActionError } from '../actions';

export function SignOutOthersButton({ otherSessions }: { otherSessions: number }) {
  const t = useTranslations('account');
  const router = useRouter();
  const [error, setError] = useState<AccountActionError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending || otherSessions === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await signOutOtherSessionsAction();
              setError(result.ok ? null : result.error);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <MonitorSmartphone aria-hidden />}
          {t('sessions.signOutOthers')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
    </div>
  );
}
