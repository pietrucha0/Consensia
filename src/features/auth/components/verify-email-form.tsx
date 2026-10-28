'use client';

import { CircleAlert, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { verifyEmailAction } from '../actions';
import type { ActionResult } from '../errors';

/**
 * Verification is a POST behind a button, not a side effect of opening the link:
 * mail scanners (Outlook Safe Links etc.) pre-fetch URLs and would burn the token.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const verify = () => {
    startTransition(async () => {
      setResult(await verifyEmailAction({ token, locale }));
    });
  };

  return (
    <div className="grid gap-5">
      {result && !result.ok && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      )}
      <Button size="lg" onClick={verify} disabled={pending || (result !== null && !result.ok)}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t('verifyEmail.submit')}
      </Button>
    </div>
  );
}
