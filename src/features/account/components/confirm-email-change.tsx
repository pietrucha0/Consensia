'use client';

import { CircleAlert, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { confirmEmailChangeAction, type AccountActionError } from '../actions';

/** Explicit button (POST): opening the link alone — e.g. by a mail scanner — changes nothing. */
export function ConfirmEmailChange({ token }: { token: string }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [error, setError] = useState<AccountActionError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              // On success the action redirects to the account page.
              const result = await confirmEmailChangeAction({ token, locale });
              if (!result.ok) setError(result.error);
            })
          }
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t('email.confirm')}
        </Button>
      </div>
    </div>
  );
}
