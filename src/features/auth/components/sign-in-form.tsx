'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';

import { resendVerificationAction, signInAction } from '../actions';
import type { ActionResult } from '../errors';
import { signInSchema } from '../schemas';

import { PasswordInput } from './password-input';

type Props = {
  callbackUrl?: string | undefined;
  notice?: 'verified' | 'reset' | undefined;
};

export function SignInForm({ callbackUrl, notice }: Props) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setResent(false);
    startTransition(async () => {
      // On success the action redirects; only failures come back here.
      setResult(await signInAction({ ...values, locale, callbackUrl }));
    });
  });

  const resendVerification = () => {
    startTransition(async () => {
      await resendVerificationAction({ ...form.getValues(), locale });
      setResent(true);
    });
  };

  const error = result && !result.ok ? result.error : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>
            <p>{t(`errors.${error}`)}</p>
            {error === 'email_not_verified' && !resent && (
              <Button type="button" variant="link" className="h-auto p-0 text-destructive" onClick={resendVerification} disabled={pending}>
                {t('signIn.resendVerification')}
              </Button>
            )}
            {resent && <p>{t('signIn.verificationResent')}</p>}
          </AlertDescription>
        </Alert>
      ) : (
        notice && (
          <Alert variant="success">
            <CircleCheck />
            <AlertDescription>{t(notice === 'verified' ? 'signIn.verifiedNotice' : 'signIn.resetNotice')}</AlertDescription>
          </Alert>
        )
      )}

      <FormField id="email" label={t('signIn.email')} error={validationMessage(errors.email?.message)}>
        {(a11y) => <Input {...a11y} type="email" autoComplete="email" autoFocus {...form.register('email')} />}
      </FormField>

      <FormField
        id="password"
        label={t('signIn.password')}
        error={validationMessage(errors.password?.message)}
        aside={
          <Link href="/auth/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            {t('signIn.forgotPassword')}
          </Link>
        }
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="current-password" {...form.register('password')} />}
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t('signIn.submit')}
      </Button>
    </form>
  );
}
