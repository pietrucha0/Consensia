import { ArrowLeft, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { env } from '@/env';
import { ResolutionForm } from '@/features/resolutions/components/resolution-form';
import { getResolutionForEdit } from '@/features/resolutions/queries';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.resolutions');
  return { title: t('edit') };
}

export default async function EditResolutionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ADMIN', 'MODERATOR']);
  const { id } = await params;
  const resolution = await getResolutionForEdit(id);
  if (!resolution) notFound();

  const t = await getTranslations('admin.resolutions');

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/admin/resolutions" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToList')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('edit')}</h1>
      </header>
      {resolution.status === 'DRAFT' ? (
        <ResolutionForm key={id} resolutionId={id} initialValues={resolution.values} timeZone={env.APP_TIME_ZONE} />
      ) : (
        <Alert>
          <Lock />
          <AlertDescription>
            <p>{t('lockedNotice')}</p>
            <Link href={`/resolutions/${id}`} className="font-medium underline underline-offset-4">
              {t('view')}
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
