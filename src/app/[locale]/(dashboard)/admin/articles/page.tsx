import { CircleCheck, ExternalLink, Pencil, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DeleteArticleButton } from '@/features/articles/components/delete-article-button';
import { StatusBadge } from '@/features/articles/components/status-badge';
import { listArticlesForAdmin } from '@/features/articles/queries';
import { Link } from '@/i18n/navigation';
import { isLocale } from '@/i18n/routing';
import { requireRole } from '@/lib/dal';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.articles');
  return { title: t('title') };
}

const NOTICES = ['created', 'deleted'] as const;

type Props = { params: Promise<{ locale: string }>; searchParams: SearchParams };

export default async function AdminArticlesPage({ params, searchParams }: Props) {
  await requireRole(['ADMIN']);
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [articles, t, format] = await Promise.all([
    listArticlesForAdmin(locale),
    getTranslations('admin'),
    getFormatter(),
  ]);
  const noticeParam = firstParam((await searchParams).notice);
  const notice = NOTICES.find((n) => n === noticeParam);
  const date = (value: Date | null) => (value ? format.dateTime(value, { dateStyle: 'medium' }) : '—');

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('articles.title')}</h1>
        <Button asChild>
          <Link href="/admin/articles/new">
            <Plus aria-hidden />
            {t('articles.new')}
          </Link>
        </Button>
      </header>

      {notice && (
        <Alert variant="success">
          <CircleCheck />
          <AlertDescription>{t(`articles.${notice}`)}</AlertDescription>
        </Alert>
      )}

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center text-muted-foreground">
          {t('articles.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('articles.colTitle')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('articles.colStatus')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('articles.colLanguages')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('articles.colPublished')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('articles.colUpdated')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('articles.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.map((article) => (
                <tr key={article.id} className="align-middle hover:bg-muted/30">
                  <td className="max-w-80 px-4 py-3">
                    <Link href={`/admin/articles/${article.id}/edit`} className="line-clamp-2 font-medium hover:text-primary">
                      {article.title}
                    </Link>
                    <p className="truncate font-mono text-xs text-muted-foreground">/{article.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} label={t(`status.${article.status}`)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {article.locales.map((l) => (
                        <Badge key={l} variant="outline" className="uppercase">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{date(article.publishedAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{date(article.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/articles/${article.slug}`} title={t('articles.view')}>
                          <ExternalLink aria-hidden />
                          <span className="sr-only lg:not-sr-only">{t('articles.view')}</span>
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/articles/${article.id}/edit`}>
                          <Pencil aria-hidden />
                          <span className="sr-only lg:not-sr-only">{t('articles.editAction')}</span>
                        </Link>
                      </Button>
                      <DeleteArticleButton id={article.id} title={article.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
