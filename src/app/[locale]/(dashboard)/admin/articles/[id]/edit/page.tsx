import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ArticleForm } from '@/features/articles/components/article-form';
import { getArticleForEdit } from '@/features/articles/queries';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/dal';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.articles');
  return { title: t('edit') };
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['ADMIN']);
  const { id } = await params;
  const values = await getArticleForEdit(id);
  if (!values) notFound();

  const t = await getTranslations('admin.articles');

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <Link href="/admin/articles" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t('backToList')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('edit')}</h1>
      </header>
      {/* key: a different article must mount a fresh form (editors read initial content once). */}
      <ArticleForm key={id} articleId={id} initialValues={values} />
    </div>
  );
}
