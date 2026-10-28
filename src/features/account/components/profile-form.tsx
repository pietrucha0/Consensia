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
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { routing } from '@/i18n/routing';

import { updateProfileAction, type AccountActionResult } from '../actions';
import { profileSchema, type ProfileValues } from '../schemas';

export function ProfileForm({ defaults }: { defaults: ProfileValues }) {
  const t = useTranslations('account');
  const tLocales = useTranslations('locales');
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await updateProfileAction(values);
      setResult(outcome);
      if (outcome.ok) form.reset(values);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {result && (
        <Alert variant={result.ok ? 'success' : 'destructive'}>
          {result.ok ? <CircleCheck /> : <CircleAlert />}
          <AlertDescription>{result.ok ? t('profile.saved') : t(`errors.${result.error}`)}</AlertDescription>
        </Alert>
      )}

      <FormField id="name" label={t('profile.name')} error={validationMessage(errors.name?.message)}>
        {(a11y) => <Input {...a11y} autoComplete="name" {...form.register('name')} />}
      </FormField>

      <FormField id="preferredLocale" label={t('profile.language')} hint={t('profile.languageHint')}>
        {(a11y) => (
          <NativeSelect {...a11y} {...form.register('preferredLocale')}>
            {routing.locales.map((locale) => (
              <option key={locale} value={locale}>
                {tLocales(locale)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <div className="flex items-start gap-3">
        <input
          id="notifyNewResolutions"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          aria-describedby="notifyNewResolutions-hint"
          {...form.register('notifyNewResolutions')}
        />
        <div className="grid gap-1">
          <label htmlFor="notifyNewResolutions" className="text-sm font-medium leading-none">
            {t('profile.notify')}
          </label>
          <p id="notifyNewResolutions-hint" className="text-xs text-muted-foreground">
            {t('profile.notifyHint')}
          </p>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending || !isDirty}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t('profile.save')}
        </Button>
      </div>
    </form>
  );
}
