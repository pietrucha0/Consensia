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

import { signUpAction } from '../actions';
import type { ActionResult } from '../errors';
import { PASSWORD_MIN_LENGTH, signUpSchema } from '../schemas';

import { PasswordInput } from './password-input';

export function SignUpForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await signUpAction({ ...values, locale });
      if (res.ok) setSubmittedEmail(values.email);
      setResult(res);
    });
  });

  if (result?.ok) {
    return (
      <Alert variant="success">
        <MailCheck />
        <AlertTitle>{t('signUp.successTitle')}</AlertTitle>
        <AlertDescription>{t('signUp.successBody', { email: submittedEmail })}</AlertDescription>
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

      <FormField id="name" label={t('signUp.name')} error={validationMessage(errors.name?.message)}>
        {(a11y) => <Input {...a11y} autoComplete="name" autoFocus {...form.register('name')} />}
      </FormField>

      <FormField id="email" label={t('signUp.email')} error={validationMessage(errors.email?.message)}>
        {(a11y) => <Input {...a11y} type="email" autoComplete="email" {...form.register('email')} />}
      </FormField>

      <FormField
        id="password"
        label={t('signUp.password')}
        hint={t('signUp.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={validationMessage(errors.password?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...form.register('password')} />}
      </FormField>

      <FormField
        id="confirmPassword"
        label={t('signUp.confirmPassword')}
        error={validationMessage(errors.confirmPassword?.message)}
      >
        {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...form.register('confirmPassword')} />}
      </FormField>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t('signUp.submit')}
      </Button>
    </form>
  );
}
