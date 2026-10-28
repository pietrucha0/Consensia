'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { resetPasswordAction } from '../actions';
import type { ActionResult } from '../errors';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '../schemas';

import { PasswordInput } from './password-input';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const tSignUp = useTranslations('auth.signUp');
  const locale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      // On success the action redirects to sign-in.
      setResult(await resetPasswordAction({ ...values, token, locale }));
    });
  });

  if (result && !result.ok && result.error === 'invalid_token') {
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertDescription>
          <p>{t('errors.invalid_token')}</p>
          <Link href="/auth/forgot-password" className="font-medium underline underline-offset-4">
            {t('resetPassword.requestNew')}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && !result.ok && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      )}

      <FormField
        id="password"
        label={t('resetPassword.password')}
        hint={tSignUp('passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={validationMessage(errors.password?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" autoFocus {...form.register('password')} />}
      </FormField>

      <FormField
        id="confirmPassword"
        label={t('resetPassword.confirmPassword')}
        error={validationMessage(errors.confirmPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...form.register('confirmPassword')} />}
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t('resetPassword.submit')}
      </Button>
    </form>
  );
}
