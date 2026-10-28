'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useUnsavedChangesGuard } from '@/components/form/use-unsaved-changes-guard';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { HeroImageField } from '@/features/articles/components/hero-image-field';
import { routing, type Locale } from '@/i18n/routing';

import { saveResolutionAction, type ResolutionActionResult } from '../actions';
import {
  RESOLUTION_MAX_OPTIONS,
  RESOLUTION_MIN_OPTIONS,
  resolutionFormSchema,
  type OptionLabels,
  type ResolutionFormValues,
} from '../schemas';

type Props = {
  resolutionId?: string;
  initialValues: ResolutionFormValues;
  timeZone: string;
};

function firstLocaleWithErrors(errors: FieldErrors<ResolutionFormValues>): Locale | undefined {
  return routing.locales.find((locale) => errors.translations?.[locale] !== undefined);
}

const emptyLabels = (): OptionLabels => ({ en: '', pl: '', es: '', fr: '' });

export function ResolutionForm({ resolutionId, initialValues, timeZone }: Props) {
  const t = useTranslations('admin.resolutions');
  const tLocales = useTranslations('locales');
  const uiLocale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ResolutionActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<Locale>(
    () => routing.locales.find((l) => initialValues.translations[l].title !== '') ?? uiLocale,
  );

  const form = useForm({ resolver: zodResolver(resolutionFormSchema), defaultValues: initialValues });
  const { errors, isDirty } = form.formState;
  const options = useFieldArray({ control: form.control, name: 'options' });
  const imageUrl = useWatch({ control: form.control, name: 'imageUrl' });
  const titles = useWatch({ control: form.control, name: routing.locales.map((l) => `translations.${l}.title` as const) });

  useUnsavedChangesGuard(isDirty && !pending, t('form.leaveConfirm'));

  const onSubmit = form.handleSubmit(
    (values) => {
      setResult(null);
      startTransition(async () => {
        const response = await saveResolutionAction({ locale: uiLocale, id: resolutionId, values });
        setResult(response);
        if (response.ok) form.reset(values);
      });
    },
    (invalid) => {
      const locale = firstLocaleWithErrors(invalid);
      if (locale) setActiveTab(locale);
    },
  );

  const translationsError = validationMessage(errors.translations?.message);
  const optionsError = validationMessage(errors.options?.message ?? errors.options?.root?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid gap-6">
        {/* ── Text per language ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('form.content')}</CardTitle>
            <CardDescription>{t('form.contentHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {translationsError && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{translationsError}</AlertDescription>
              </Alert>
            )}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Locale)}>
              <TabsList>
                {routing.locales.map((locale, index) => (
                  <TabsTrigger key={locale} value={locale}>
                    {tLocales(locale)}
                    {errors.translations?.[locale] ? (
                      <CircleAlert className="size-3.5 text-destructive" aria-label={t('errors.validation')} />
                    ) : (
                      (titles[index] ?? '').trim() !== '' && <CircleCheck className="size-3.5 text-primary" aria-hidden />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {routing.locales.map((locale) => {
                const fieldErrors = errors.translations?.[locale];
                return (
                  <TabsContent key={locale} value={locale} forceMount className="grid gap-5 data-[state=inactive]:hidden" lang={locale}>
                    <FormField id={`${locale}-title`} label={t('form.title')} error={validationMessage(fieldErrors?.title?.message)}>
                      {(a11y) => <Input {...a11y} {...form.register(`translations.${locale}.title`)} />}
                    </FormField>
                    <FormField
                      id={`${locale}-description`}
                      label={t('form.description')}
                      hint={t('form.descriptionHint')}
                      error={validationMessage(fieldErrors?.description?.message)}
                    >
                      {(a11y) => (
                        <Textarea {...a11y} rows={12} className="min-h-64" {...form.register(`translations.${locale}.description`)} />
                      )}
                    </FormField>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Options: rows = options, columns = languages ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('form.options')}</CardTitle>
            <CardDescription>{t('form.optionsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {optionsError && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{optionsError}</AlertDescription>
              </Alert>
            )}
            <ol className="grid gap-4">
              {options.fields.map((field, index) => {
                const number = index + 1;
                const labelErrors = errors.options?.[index]?.labels;
                return (
                  <li key={field.id} className="grid gap-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t('form.option', { number })}</span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => options.move(index, index - 1)}
                          aria-label={t('form.moveUp', { number })}
                        >
                          <ArrowUp aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === options.fields.length - 1}
                          onClick={() => options.move(index, index + 1)}
                          aria-label={t('form.moveDown', { number })}
                        >
                          <ArrowDown aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                          disabled={options.fields.length <= RESOLUTION_MIN_OPTIONS}
                          onClick={() => options.remove(index)}
                          aria-label={t('form.removeOption', { number })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {routing.locales.map((locale) => (
                        <FormField
                          key={locale}
                          id={`option-${index}-${locale}`}
                          label={tLocales(locale)}
                          error={validationMessage(labelErrors?.[locale]?.message)}
                        >
                          {(a11y) => <Input {...a11y} lang={locale} {...form.register(`options.${index}.labels.${locale}`)} />}
                        </FormField>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={options.fields.length >= RESOLUTION_MAX_OPTIONS}
              onClick={() => options.append({ labels: emptyLabels() })}
            >
              <Plus aria-hidden />
              {t('form.addOption')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Sidebar ── */}
      <div className="grid gap-6 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('form.general')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField id="reference" label={t('form.reference')} hint={t('form.referenceHint')} error={validationMessage(errors.reference?.message)}>
              {(a11y) => <Input {...a11y} className="tabular-nums" {...form.register('reference')} />}
            </FormField>
            <FormField
              id="closesAt"
              label={t('form.closesAt')}
              hint={t('form.closesAtHint', { timeZone })}
              error={validationMessage(errors.closesAt?.message)}
            >
              {(a11y) => <Input {...a11y} type="datetime-local" {...form.register('closesAt')} />}
            </FormField>
            <FormField
              id="attachmentUrl"
              label={t('form.attachmentUrl')}
              hint={t('form.attachmentHint')}
              error={validationMessage(errors.attachmentUrl?.message)}
            >
              {(a11y) => <Input {...a11y} type="url" inputMode="url" placeholder="https://" {...form.register('attachmentUrl')} />}
            </FormField>
            <div className="grid gap-2">
              <span className="text-sm leading-none font-medium">{t('form.image')}</span>
              <HeroImageField
                value={imageUrl}
                onChange={(url) => form.setValue('imageUrl', url, { shouldDirty: true, shouldValidate: true })}
                error={validationMessage(errors.imageUrl?.message)}
                inputProps={form.register('imageUrl')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {result && !result.ok && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{t(`errors.${result.error}`)}</AlertDescription>
            </Alert>
          )}
          {result?.ok && !isDirty && (
            <Alert variant="success">
              <CircleCheck />
              <AlertDescription>{t('saved')}</AlertDescription>
            </Alert>
          )}
          {isDirty && <p className="text-sm text-warning">{t('form.unsavedChanges')}</p>}
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {resolutionId ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </div>
    </form>
  );
}
