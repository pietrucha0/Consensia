'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/features/auth/components/password-input';
import { PASSWORD_MIN_LENGTH } from '@/features/auth/schemas';

import { changePasswordAction, type AccountActionResult } from '../actions';
import { changePasswordSchema } from '../schemas';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordForm() {
  const t = useTranslations('account');
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await changePasswordAction(values);
      setResult(outcome);
      if (outcome.ok) form.reset(EMPTY);
      else if (outcome.error === 'wrong_password') form.setFocus('currentPassword');
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && (
        <Alert variant={result.ok ? 'success' : 'destructive'}>
          {result.ok ? <CircleCheck /> : <CircleAlert />}
          <AlertDescription>{result.ok ? t('password.changed') : t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      )}

      <FormField
        id="currentPassword"
        label={t('password.current')}
        error={validationMessage(errors.currentPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="current-password" {...form.register('currentPassword')} />}
      </FormField>

      <FormField
        id="newPassword"
        label={t('password.new')}
        hint={t('password.hint', { min: PASSWORD_MIN_LENGTH })}
        error={validationMessage(errors.newPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...form.register('newPassword')} />}
      </FormField>

      <FormField
        id="confirmNewPassword"
        label={t('password.confirm')}
        error={validationMessage(errors.confirmPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...form.register('confirmPassword')} />}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t('password.submit')}
        </Button>
      </div>
    </form>
  );
}
