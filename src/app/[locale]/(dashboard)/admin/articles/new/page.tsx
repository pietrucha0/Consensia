import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ArticleForm } from '@/features/articles/components/article-form';
import { emptyArticleForm } from '@/features/articles/schemas';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.articles');
  return { title: t('new') };
}

export default async function NewArticlePage() {
  await requireRole(['ADMIN']);
  const t = await getTranslations('admin.articles');

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/admin/articles" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToList')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('new')}</h1>
      </header>
      <ArticleForm initialValues={emptyArticleForm()} />
    </div>
  );
}
