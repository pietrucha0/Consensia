import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { env } from '@/env';
import { ResolutionForm } from '@/features/resolutions/components/resolution-form';
import { emptyResolutionForm, type OptionLabels } from '@/features/resolutions/schemas';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.resolutions');
  return { title: t('new') };
}

const DEFAULT_OPTION_KEYS = ['for', 'against', 'abstain'] as const;

/** For / Against / Abstain, pre-filled in every language from the message catalogs. */
async function defaultOptions(): Promise<OptionLabels[]> {
  const namespace = 'resolutions.defaultOptions';
  const [en, pl, es, fr] = await Promise.all([
    getTranslations({ locale: 'en', namespace }),
    getTranslations({ locale: 'pl', namespace }),
    getTranslations({ locale: 'es', namespace }),
    getTranslations({ locale: 'fr', namespace }),
  ]);
  return DEFAULT_OPTION_KEYS.map((key) => ({ en: en(key), pl: pl(key), es: es(key), fr: fr(key) }));
}

export default async function NewResolutionPage() {
  await requireRole(['ADMIN', 'MODERATOR']);
  const [t, options] = await Promise.all([getTranslations('admin.resolutions'), defaultOptions()]);

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/admin/resolutions" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToList')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('new')}</h1>
      </header>
      <ResolutionForm initialValues={emptyResolutionForm(options)} timeZone={env.APP_TIME_ZONE} />
    </div>
  );
}
