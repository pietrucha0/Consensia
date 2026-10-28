'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Loader2, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { forgotPasswordAction } from '../actions';
import type { ActionResult } from '../errors';
import { forgotPasswordSchema } from '../schemas';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await forgotPasswordAction({ ...values, locale });
      if (res.ok) setSubmittedEmail(values.email);
      setResult(res);
    });
  });

  if (result?.ok) {
    return (
      <Alert variant="success">
        <MailCheck />
        <AlertTitle>{t('forgotPassword.successTitle')}</AlertTitle>
        <AlertDescription>{t('forgotPassword.successBody', { email: submittedEmail })}</AlertDescription>
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

      <FormField id="email" label={t('forgotPassword.email')} error={validationMessage(errors.email?.message)}>
        {(a11y) => <Input {...a11y} type="email" autoComplete="email" autoFocus {...form.register('email')} />}
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t('forgotPassword.submit')}
      </Button>
    </form>
  );
}
