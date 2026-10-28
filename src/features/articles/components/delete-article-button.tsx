'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type MouseEvent } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { deleteArticleAction, type ArticleActionError } from '../actions';

export function DeleteArticleButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ArticleActionError | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = (event: MouseEvent) => {
    event.preventDefault(); // keep the dialog open until the action finishes
    startTransition(async () => {
      const result = await deleteArticleAction({ id });
      if (result.ok) {
        setOpen(false);
        router.replace({ pathname: '/admin/articles', query: { notice: 'deleted' } });
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive-soft hover:text-destructive">
          <Trash2 aria-hidden />
          <span className="sr-only lg:not-sr-only">{t('articles.delete')}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('articles.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('articles.deleteBody', { title })}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('articles.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t('articles.confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
