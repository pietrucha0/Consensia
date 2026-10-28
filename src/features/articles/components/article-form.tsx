'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, CircleCheck, Loader2, Save, Wand2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { FormField } from '@/components/form/form-field';
import { useUnsavedChangesGuard } from '@/components/form/use-unsaved-changes-guard';
import { useValidationMessage } from '@/components/form/use-validation-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { routing, type Locale } from '@/i18n/routing';

import { saveArticleAction, type ArticleActionResult } from '../actions';
import { parseRichText } from '../rich-text';
import { ARTICLE_STATUSES, articleFormSchema, slugify, type ArticleFormValues } from '../schemas';

import { HeroImageField } from './hero-image-field';
import { RichTextEditor } from './rich-text-editor';

type Props = {
  /** Omitted when creating. */
  articleId?: string;
  initialValues: ArticleFormValues;
};

function firstLocaleWithErrors(errors: FieldErrors<ArticleFormValues>): Locale | undefined {
  return routing.locales.find((locale) => errors.translations?.[locale] !== undefined);
}

export function ArticleForm({ articleId, initialValues }: Props) {
  const t = useTranslations('admin');
  const tLocales = useTranslations('locales');
  const uiLocale = useLocale();
  const validationMessage = useValidationMessage();
  const [result, setResult] = useState<ArticleActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // New articles derive their slug from the title until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(articleId !== undefined);
  const [activeTab, setActiveTab] = useState<Locale>(
    () => routing.locales.find((l) => initialValues.translations[l].title !== '') ?? uiLocale,
  );

  const form = useForm({
    resolver: zodResolver(articleFormSchema),
    defaultValues: initialValues,
  });
  const { errors, isDirty } = form.formState;
  const titles = useWatch({ control: form.control, name: routing.locales.map((l) => `translations.${l}.title` as const) });
  const heroImageUrl = useWatch({ control: form.control, name: 'heroImageUrl' });

  const firstTitle = titles.find((title) => title.trim() !== '') ?? '';

  useEffect(() => {
    if (!slugTouched) form.setValue('slug', slugify(firstTitle), { shouldDirty: true });
  }, [firstTitle, slugTouched, form]);

  // While saving, the form is still dirty but the create action redirects on its own.
  useUnsavedChangesGuard(isDirty && !pending, t('form.leaveConfirm'));

  const onSubmit = form.handleSubmit(
    (values) => {
      setResult(null);
      startTransition(async () => {
        // Creating redirects to the list on success; updating returns here.
        const response = await saveArticleAction({ locale: uiLocale, id: articleId, values });
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

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {/* ── Content (per language) ── */}
      <Card className="lg:order-1">
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
              {routing.locales.map((locale, index) => {
                const hasError = errors.translations?.[locale] !== undefined;
                const filled = (titles[index] ?? '').trim() !== '';
                return (
                  <TabsTrigger key={locale} value={locale}>
                    {tLocales(locale)}
                    {hasError ? (
                      <CircleAlert className="size-3.5 text-destructive" aria-label={t('errors.validation')} />
                    ) : (
                      filled && <CircleCheck className="size-3.5 text-primary" aria-label={t('form.filled')} />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {routing.locales.map((locale) => {
              const fieldErrors = errors.translations?.[locale];
              const prefix = `translations.${locale}` as const;
              return (
                // forceMount keeps every editor alive, so switching tabs never loses unsaved text.
                <TabsContent key={locale} value={locale} forceMount className="grid gap-5 data-[state=inactive]:hidden" lang={locale}>
                  <FormField id={`${locale}-title`} label={t('form.title')} error={validationMessage(fieldErrors?.title?.message)}>
                    {(a11y) => <Input {...a11y} {...form.register(`${prefix}.title`)} />}
                  </FormField>
                  <FormField id={`${locale}-summary`} label={t('form.summary')} error={validationMessage(fieldErrors?.summary?.message)}>
                    {(a11y) => <Textarea {...a11y} rows={3} {...form.register(`${prefix}.summary`)} />}
                  </FormField>
                  <div className="grid gap-2">
                    <span id={`${locale}-body-label`} className="text-sm leading-none font-medium">
                      {t('form.body')}
                    </span>
                    <Controller
                      control={form.control}
                      name={`${prefix}.body`}
                      render={({ field, fieldState }) => (
                        <RichTextEditor
                          id={`${locale}-body`}
                          labelId={`${locale}-body-label`}
                          initialContent={parseRichText(initialValues.translations[locale].body)}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          invalid={fieldState.error !== undefined}
                          describedBy={fieldState.error ? `${locale}-body-error` : undefined}
                        />
                      )}
                    />
                    {fieldErrors?.body?.message && (
                      <p id={`${locale}-body-error`} className="text-sm text-destructive">
                        {validationMessage(fieldErrors.body.message)}
                      </p>
                    )}
                  </div>
                  <FormField
                    id={`${locale}-footer`}
                    label={t('form.footer')}
                    hint={t('form.footerHint')}
                    error={validationMessage(fieldErrors?.footer?.message)}
                  >
                    {(a11y) => <Textarea {...a11y} rows={3} {...form.register(`${prefix}.footer`)} />}
                  </FormField>
                  <FormField
                    id={`${locale}-hero-alt`}
                    label={t('form.heroImageAlt')}
                    hint={t('form.heroImageAltHint')}
                    error={validationMessage(fieldErrors?.heroImageAlt?.message)}
                  >
                    {(a11y) => <Input {...a11y} {...form.register(`${prefix}.heroImageAlt`)} />}
                  </FormField>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Sidebar: general settings + save ── */}
      <div className="grid gap-6 lg:sticky lg:top-6 lg:order-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('form.general')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField
              id="slug"
              label={t('form.slug')}
              hint={t('form.slugHint', { slug: form.watch('slug') || '…' })}
              error={validationMessage(errors.slug?.message)}
              aside={
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setSlugTouched(false);
                    form.setValue('slug', slugify(firstTitle), { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  <Wand2 aria-hidden />
                  {t('form.generateSlug')}
                </Button>
              }
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  className="font-mono text-sm"
                  {...form.register('slug', { onChange: () => setSlugTouched(true) })}
                />
              )}
            </FormField>

            <FormField id="status" label={t('form.status')} hint={t('form.statusHint')}>
              {(a11y) => (
                <NativeSelect {...a11y} {...form.register('status')}>
                  {ARTICLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>

            <div className="grid gap-2">
              <span className="text-sm leading-none font-medium">{t('form.heroImage')}</span>
              <HeroImageField
                value={heroImageUrl}
                onChange={(url) => form.setValue('heroImageUrl', url, { shouldDirty: true, shouldValidate: true })}
                error={validationMessage(errors.heroImageUrl?.message)}
                inputProps={form.register('heroImageUrl')}
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
              <AlertDescription>{t('articles.saved')}</AlertDescription>
            </Alert>
          )}
          {isDirty && <p className="text-sm text-warning">{t('form.unsavedChanges')}</p>}
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {articleId ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </div>
    </form>
  );
}
