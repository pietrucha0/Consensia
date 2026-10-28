'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Loader2, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/features/auth/components/password-input';

import { requestEmailChangeAction, type AccountActionResult } from '../actions';
import { changeEmailSchema } from '../schemas';

const EMPTY = { newEmail: '', currentPassword: '' };

export function ChangeEmailForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [pending, startTransition] = useTransition();

  const form = useForm({ resolver: zodResolver(changeEmailSchema), defaultValues: EMPTY });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await requestEmailChangeAction({ ...values, locale });
      setResult(outcome);
      if (outcome.ok) {
        setSentTo(values.newEmail.trim().toLowerCase());
        form.reset(EMPTY);
      } else if (outcome.error === 'wrong_password') {
        form.setFocus('currentPassword');
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && (
        <Alert variant={result.ok ? 'success' : 'destructive'}>
          {result.ok ? <MailCheck /> : <CircleAlert />}
          <AlertDescription>
            {result.ok ? t('email.sent', { email: sentTo }) : t(`errors.${result.error}`)}
          </AlertDescription>
        </Alert>
      )}

      <FormField id="newEmail" label={t('email.new')} error={validationMessage(errors.newEmail?.message)}>
        {(a11y) => <Input {...a11y} type="email" autoComplete="email" {...form.register('newEmail')} />}
      </FormField>

      <FormField
        id="emailCurrentPassword"
        label={t('password.current')}
        error={validationMessage(errors.currentPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="current-password" {...form.register('currentPassword')} />}
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t('email.submit')}
        </Button>
      </div>
    </form>
  );
}
